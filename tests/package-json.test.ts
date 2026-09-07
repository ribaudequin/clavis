import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
  name?: string;
  productName?: string;
};

describe('package.json regression: userData path stability', () => {
  it('has a productName field', () => {
    expect(pkg.productName).toBeDefined();
    expect(pkg.productName).not.toBe('');
  });

  it('productName matches name (case-sensitive, lowercase)', () => {
    expect(pkg.productName).toBe(pkg.name);
  });

  it('productName is lowercase ASCII (Electron userData path is case-sensitive on Linux/macOS)', () => {
    expect(pkg.productName).toMatch(/^[a-z0-9-]+$/);
  });

  it('app.getPath("userData") in a packaged build will end with this productName', () => {
    expect(pkg.productName).toBe('clavis');
  });
});