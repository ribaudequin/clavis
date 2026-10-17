import { z } from 'zod';
import { MAX_CONTENT_CODE_POINTS } from '../shared/limits.js';

export const CreateDrawerSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export const UnlockDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
});

export const SaveDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  // The cap is in code points, not bytes — Zod's .max() folds surrogate pairs, so this
  // admits up to 4x MAX_PLAINTEXT_BYTES of UTF-8 text. The byte cap lives in
  // encrypt() (SAV-01). Main-process log text only: the renderer translates on
  // ErrorCode, not on this string.
  content: z.string().max(MAX_CONTENT_CODE_POINTS, `Content too large (max ${MAX_CONTENT_CODE_POINTS.toLocaleString('en-US')} code points)`),
});

export const DeleteDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
});

export const EncryptedDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer id'),
  title: z.string().min(1).max(255),
  iconData: z.string().max(4096),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  encryptedData: z.string(),
  salt: z.string(),
  iv: z.string(),
  authTag: z.string(),
  keyDerivation: z.object({
    algorithm: z.enum(['argon2id', 'scrypt']),
    iterations: z.number().int().positive(),
    memory: z.number().int().positive(),
    parallelism: z.number().int().positive(),
  }),
});

export const ExportDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
});

export const ImportDrawerSchema = z.object({
  token: z.string().uuid('Invalid import token'),
});

export type CreateDrawerInput = z.infer<typeof CreateDrawerSchema>;
export type UnlockDrawerInput = z.infer<typeof UnlockDrawerSchema>;
export type SaveDrawerInput = z.infer<typeof SaveDrawerSchema>;
export type DeleteDrawerInput = z.infer<typeof DeleteDrawerSchema>;
export type ExportDrawerInput = z.infer<typeof ExportDrawerSchema>;
export type ImportDrawerInput = z.infer<typeof ImportDrawerSchema>;
