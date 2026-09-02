import * as crypto from 'crypto';
import argon2 from 'argon2';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

const DEFAULT_ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 2 ** 16,
  parallelism: 1,
};

export interface KDFParams {
  timeCost?: number;
  memoryCost?: number;
  parallelism?: number;
}

export async function deriveKey(password: string, salt: Buffer, params?: KDFParams): Promise<Buffer> {
  const start = Date.now();
  const hash: Buffer = await argon2.hash(password, {
    ...DEFAULT_ARGON2_OPTIONS,
    ...(params && {
      timeCost: params.timeCost,
      memoryCost: params.memoryCost,
      parallelism: params.parallelism,
    }),
    salt,
    raw: true,
  });
  if (hash.length !== KEY_LENGTH) {
    throw new Error(`Argon2 raw output length ${hash.length} != expected ${KEY_LENGTH}`);
  }
  const duration = Date.now() - start;
  logger.debug('Key derived', { duration });
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
