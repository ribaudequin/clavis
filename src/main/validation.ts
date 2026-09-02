import { z } from 'zod';

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
  content: z.string().max(10_000_000, 'Content too large (max 10MB)'),
});

export const DeleteDrawerSchema = z.object({
  id: z.string().uuid('Invalid drawer ID'),
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
