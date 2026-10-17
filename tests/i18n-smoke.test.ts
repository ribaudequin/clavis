import { describe, it, expect } from 'vitest';

describe('i18n smoke', () => {
  it('exports translations, t, resolveLocale, applyDocumentLanguage', async () => {
    const mod = await import('../src/i18n');
    expect(typeof mod.translations).toBe('object');
    expect(typeof mod.t).toBe('function');
    expect(typeof mod.resolveLocale).toBe('function');
    expect(typeof mod.applyDocumentLanguage).toBe('function');
  });
});
