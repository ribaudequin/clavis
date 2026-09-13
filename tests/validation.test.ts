import { describe, it, expect } from 'vitest';
import {
  CreateDrawerSchema,
  UnlockDrawerSchema,
  SaveDrawerSchema,
  DeleteDrawerSchema,
  ExportDrawerSchema,
  ImportDrawerSchema,
} from '../src/main/validation.js';

describe('Zod schema validation', () => {
  it('SaveDrawerSchema accepts valid input including max content size boundary', () => {
    const result = SaveDrawerSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      password: 'password123',
      title: 'Test Drawer',
      content: 'x'.repeat(10_000_000),
    });
    expect(result.success).toBe(true);
  });

  it('SaveDrawerSchema rejects content exceeding 10_000_000', () => {
    const result = SaveDrawerSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      password: 'password123',
      title: 'Test Drawer',
      content: 'x'.repeat(10_000_001),
    });
    expect(result.success).toBe(false);
  });

  it('CreateDrawerSchema requires min 8 chars password', () => {
    const result = CreateDrawerSchema.safeParse({
      title: 'Test',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('ImportDrawerSchema validates UUID token', () => {
    const result = ImportDrawerSchema.safeParse({
      token: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('DeleteDrawerSchema validates UUID id', () => {
    const result = DeleteDrawerSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result.success).toBe(true);
  });
});
