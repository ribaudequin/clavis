import { describe, it, expect } from 'vitest';
import {
  CreateDrawerSchema,
  UnlockDrawerSchema,
  SaveDrawerSchema,
  DeleteDrawerSchema,
  ExportDrawerSchema,
  ImportDrawerSchema,
} from '../src/main/validation.js';
import { MAX_CONTENT_CODE_POINTS } from '../src/shared/limits.js';

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

  // The two boundary tests above hand-write the limit, so neither would notice the schema
  // drifting back to a literal of its own. This one is the wiring guard, and it also pins
  // the unit in the message: the schema counts code points, where encrypt() counts bytes,
  // which is the gap SAV-01 lives in.
  it('SaveDrawerSchema caps content at the shared code-point ceiling and reports it in code points', () => {
    const result = SaveDrawerSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      password: 'password123',
      title: 'Test Drawer',
      content: 'x'.repeat(MAX_CONTENT_CODE_POINTS + 1),
    });
    expect({ success: result.success, message: result.error?.issues[0]?.message }).toEqual({
      success: false,
      message: `Content too large (max ${MAX_CONTENT_CODE_POINTS.toLocaleString('en-US')} code points)`,
    });
  });

  it('CreateDrawerSchema rejects a password that does not meet the policy', () => {
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
