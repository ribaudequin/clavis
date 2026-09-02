import * as crypto from 'crypto';
import { promisify } from 'util';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

// Lazy-load argon2 native module with fallback to Node's scrypt.
// This prevents the hard crash "is not a valid Win32 application" when the
// wrong-architecture argon2.node is bundled (cross-build on Linux → Windows).
let argon2: any = null;
let argon2LoadError: Error | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  argon2 = require('argon2');
} catch (e) {
  argon2LoadError = e instanceof Error ? e : new Error(String(e));
  logger.warn('argon2 native module not available, falling back to scrypt', {
    error: argon2LoadError.message,
  });
}

const scryptAsync = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options?: crypto.ScryptOptions
) => Promise<Buffer>;

// Only used when argon2 is available
const DEFAULT_ARGON2_OPTIONS: any = argon2
  ? {
      type: argon2.argon2id,
      timeCost: 3,
      memoryCost: 2 ** 16,
      parallelism: 1,
    }
  : null;

export function isArgon2Available(): boolean {
  return argon2 !== null;
}

export function getArgon2LoadError(): Error | null {
  return argon2LoadError;
}

export interface KDFParams {
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
}

export async function deriveKey(password: string, salt: Buffer, params?: KDFParams): Promise<Buffer> {
  const start = Date.now();
  let hash: Buffer;
  if (argon2) {
    hash = (await argon2.hash(password, {
      ...DEFAULT_ARGON2_OPTIONS,
      ...(params && {
        timeCost: params.timeCost,
        memoryCost: params.memoryCost,
        parallelism: params.parallelism,
      }),
      salt,
      raw: true,
    })) as Buffer;
    if (hash.length !== KEY_LENGTH) {
      throw new Error(`Argon2 raw output length ${hash.length} != expected ${KEY_LENGTH}`);
    }
  } else {
    // Fallback: Node's scrypt (pure JS/OpenSSL, no native .node required).
    // Maps argon2 memoryCost to scrypt cost for comparable hardness.
    // N=16384, r=8, p=1 by default; scale N with memoryCost if provided.
    const memoryCost = params?.memoryCost ?? 2 ** 16;
    // scrypt N must be power of two; clamp between 2^14 and 2^17
    const logN = Math.min(17, Math.max(14, Math.round(Math.log2(memoryCost / 4))));
    const N = 2 ** logN;
    hash = (await scryptAsync(password, salt, KEY_LENGTH, { N, r: 8, p: params?.parallelism ?? 1 })) as Buffer;
  }
  const duration = Date.now() - start;
  logger.debug('Key derived', { duration, backend: argon2 ? 'argon2' : 'scrypt' });
  return hash;
}

export function generateSalt(): Buffer {
  return crypto.randomBytes(16);
}

export async function encrypt(plainText: string, password: string): Promise<{
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
}> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  logger.debug('Content encrypted', { size: encrypted.length });
  return {
    encryptedData: encrypted.toString('hex'),
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

export async function decrypt(
  encryptedDataHex: string,
  saltHex: string,
  ivHex: string,
  authTagHex: string,
  password: string,
  kdfParams?: KDFParams
): Promise<string> {
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedDataHex, 'hex');

  const key = await deriveKey(password, salt, kdfParams);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    logger.debug('Content decrypted', { size: decrypted.length });
    return decrypted.toString('utf8');
  } catch (e) {
    logger.error('Decryption failed', { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
