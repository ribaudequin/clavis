import * as crypto from 'crypto';
import { promisify } from 'util';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
export const MAX_DECRYPTED_SIZE = 10_000_000;

// Argon2 memoryCost is expressed in KiB.
// 2^18 KiB = 256 MiB — comfortably above OWASP's ~19 MiB minimum while staying
// well below the ~2 GiB native allocation that crashes the Electron main process
// with SIGTRAP (observed at 2^21 KiB). Legacy drawers were created with 2^16 KiB
// (64 MiB), so the floor remains at 2^16 to keep them unlockable after migration.
export const DEFAULT_TIME_COST = 3;
export const DEFAULT_MEMORY_COST = 2 ** 18;
export const DEFAULT_PARALLELISM = 4;
export const MIN_MEMORY_COST = 2 ** 16;
export const MAX_MEMORY_COST = 2 ** 20;
export const MIN_TIME_COST = 3;
export const MAX_TIME_COST = 10;
export const MIN_PARALLELISM = 1;
export const MAX_PARALLELISM = 8;

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
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options?: crypto.ScryptOptions
) => Promise<Buffer>;

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

export async function deriveKey(password: string | Buffer, salt: Buffer, params?: KDFParams): Promise<Buffer> {
  const start = Date.now();
  // P0.7 — Convert to Buffer for zeroing; make a copy so original can be zeroed separately
  const passwordBuffer = Buffer.isBuffer(password) ? Buffer.from(password) : Buffer.from(password, 'utf8');
  // Resolve the effective parameters once so argon2 and the scrypt fallback use
  // the exact same cost factors. Otherwise a drawer created with defaults would
  // be encrypted with one cost (scrypt default) but its stored metadata would
  // describe another (argon2 default), making it impossible to unlock later.
  const timeCost = params?.timeCost ?? DEFAULT_TIME_COST;
  const memoryCost = params?.memoryCost ?? DEFAULT_MEMORY_COST;
  const parallelism = params?.parallelism ?? DEFAULT_PARALLELISM;
  let hash: Buffer;
  if (argon2) {
    hash = (await argon2.hash(passwordBuffer, {
      type: argon2.argon2id,
      timeCost,
      memoryCost,
      parallelism,
      salt,
      raw: true,
    })) as Buffer;
    if (hash.length !== KEY_LENGTH) {
      throw new Error(`Argon2 raw output length ${hash.length} != expected ${KEY_LENGTH}`);
    }
  } else {
    // Fallback: Node's scrypt (pure JS/OpenSSL, no native .node required).
    // Maps argon2 memoryCost to scrypt cost for comparable hardness.
    // scrypt N must be power of two; clamp between 2^14 and 2^17
    const logN = Math.min(17, Math.max(14, Math.round(Math.log2(memoryCost / 4))));
    const N = 2 ** logN;
    hash = (await scryptAsync(passwordBuffer, salt, KEY_LENGTH, { N, r: 8, p: parallelism })) as Buffer;
  }
  const duration = Date.now() - start;
  logger.debug('Key derived', { duration, backend: argon2 ? 'argon2' : 'scrypt' });
  // P0.7 — Zero password buffer from memory
  passwordBuffer.fill(0);
  return hash;
}

export function generateSalt(): Buffer {
  return crypto.randomBytes(16);
}

export async function encrypt(plainText: string, password: string | Buffer, params?: KDFParams): Promise<{
  encryptedData: string;
  salt: string;
  iv: string;
  authTag: string;
}> {
  const salt = generateSalt();
  const key = await deriveKey(password, salt, params);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  logger.debug('Content encrypted', { size: encrypted.length });
  // P0.7 — Zero derived key from memory after use
  key.fill(0);
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
  password: string | Buffer,
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
    if (decrypted.length > MAX_DECRYPTED_SIZE) {
      logger.error('Decrypted content exceeds maximum size', { size: decrypted.length });
      throw new Error('Decrypted content exceeds maximum size');
    }
    logger.debug('Content decrypted', { size: decrypted.length });
    // P0.7 — Zero derived key from memory after use
    key.fill(0);
    return decrypted.toString('utf8');
  } catch (e) {
    key.fill(0);
    logger.error('Decryption failed', { error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
