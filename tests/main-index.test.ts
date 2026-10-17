import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('main/index smoke', () => {
  it('file exists and is non-empty', () => {
    const p = path.resolve(__dirname, '../src/main/index.ts');
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).size).toBeGreaterThan(0);
  });
});
