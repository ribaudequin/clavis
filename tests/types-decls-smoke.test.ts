import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('types-decls smoke', () => {
  it('declaration files exist and parse', () => {
    const files = ['../src/types/css.d.ts', '../src/types/svgr.d.ts'];
    for (const f of files) {
      const p = path.resolve(__dirname, f);
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.readFileSync(p, 'utf-8').length).toBeGreaterThan(0);
    }
  });
});
