import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translations, t } from '../src/i18n';

const LOCALES = ['pt-PT', 'en'] as const;
const PARAMS = { version: 'v9.9.9-beta' };
const ORIGINAL_LANGUAGE = window.navigator.language;

function setLanguage(lang: string): void {
  Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
}

function parityAgainst(reference: string, locale: string): { locale: string; missing: string[]; extra: string[] } {
  const referenceKeys = Object.keys(translations[reference]).sort();
  const localeKeys = Object.keys(translations[locale]).sort();
  return {
    locale,
    missing: referenceKeys.filter((key) => !localeKeys.includes(key)),
    extra: localeKeys.filter((key) => !referenceKeys.includes(key)),
  };
}

beforeEach(() => {
  vi.stubEnv('CI', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  setLanguage(ORIGINAL_LANGUAGE);
});

describe('i18n dictionaries', () => {
  it('exposes only the supported locales and cannot silently regain pt-BR', () => {
    expect(Object.keys(translations).sort()).toEqual(['en', 'pt-PT']);
    expect(Object.keys(translations)).not.toContain('pt-BR');
  });

  it('keeps pt-PT in exact key parity with en', () => {
    expect(parityAgainst('en', 'pt-PT')).toEqual({ locale: 'pt-PT', missing: [], extra: [] });
  });

  it('exposes a non-trivial number of keys so the parity check cannot pass vacuously', () => {
    expect(Object.keys(translations['en']).length).toBeGreaterThanOrEqual(60);
    expect(Object.keys(translations['en']).length).toBe(Object.keys(translations['pt-PT']).length);
  });

  it('has no empty translation value in any locale', () => {
    for (const locale of LOCALES) {
      const empty = Object.entries(translations[locale])
        .filter(([, value]) => value.trim() === '')
        .map(([key]) => key);
      expect({ locale, empty }).toEqual({ locale, empty: [] });
    }
  });

  it('leaves every value that has no placeholder untouched when params are supplied', () => {
    setLanguage('en');
    const withoutPlaceholder = Object.entries(translations['en']).filter(([, value]) => !/\{\w+\}/.test(value));
    expect(withoutPlaceholder.length).toBeGreaterThan(60);
    for (const [key, value] of withoutPlaceholder) {
      expect(t(key, PARAMS)).toBe(value);
    }
  });
});

describe('t()', () => {
  it('resolves the same key to the dictionary of the detected locale', () => {
    setLanguage('pt-PT');
    expect(t('label.credits_title')).toBe(translations['pt-PT']['label.credits_title']);
    setLanguage('en');
    expect(t('label.credits_title')).toBe(translations['en']['label.credits_title']);
  });

  it('falls back to English when the system language has no dictionary', () => {
    setLanguage('fr-FR');
    expect(t('label.credits_title')).toBe(translations['en']['label.credits_title']);
  });

  it('substitutes a placeholder with the runtime value', () => {
    setLanguage('pt-PT');
    const rendered = t('msg.update_available', { version: 'v9.9.9-beta' });
    expect(rendered).toContain('v9.9.9-beta');
    expect(rendered).not.toContain('{version}');
    setLanguage('en');
    expect(t('msg.update_available', { version: 'v9.9.9-beta' })).toContain('v9.9.9-beta');
  });

  it('leaves a placeholder untouched when no value is supplied for it', () => {
    setLanguage('en');
    expect(t('msg.update_available', {})).toBe(translations['en']['msg.update_available']);
  });

  it('returns the key itself for an unknown translation, with or without params', () => {
    setLanguage('pt-PT');
    expect(t('msg.not_a_real_key')).toBe('msg.not_a_real_key');
    expect(() => t('msg.not_a_real_key', PARAMS)).not.toThrow();
    expect(t('msg.not_a_real_key', PARAMS)).toBe('msg.not_a_real_key');
  });
});

describe('locale routing', () => {
  const PROBE_KEY = 'label.credits_title';

  it('serves pt-PT for every Portuguese-speaking system language', () => {
    for (const lang of ['pt', 'pt-PT', 'pt-BR', 'pt-AO', 'pt-MZ', 'pt-PT-x-fonipa', 'PT-br', 'pt_BR']) {
      setLanguage(lang);
      expect({ lang, value: t(PROBE_KEY) }).toEqual({ lang, value: translations['pt-PT'][PROBE_KEY] });
    }
  });

  it('keeps Brazilian-only phrasings out of the pt-PT dictionary', () => {
    const forbidden = ['senha', 'aplicativo', 'Me pague um café', 'Excluir', 'Salvar', 'Arquivo'];
    for (const [key, value] of Object.entries(translations['pt-PT'])) {
      for (const phrase of forbidden) {
        expect({ key, phrase, present: value.includes(phrase) }).toEqual({ key, phrase, present: false });
      }
    }
  });

  it('serves English for every non-Portuguese system language', () => {
    for (const lang of ['en', 'en-US', 'fr-FR', 'es', 'es-419', 'de', 'zh-CN', 'ptx']) {
      setLanguage(lang);
      expect({ lang, value: t(PROBE_KEY) }).toEqual({ lang, value: translations['en'][PROBE_KEY] });
    }
  });

  it('serves English for an empty or malformed system language', () => {
    for (const lang of ['', '   ', 'not-a-locale', '-', '!!!', 'p', 'ptt-PT']) {
      setLanguage(lang);
      expect({ lang, value: t(PROBE_KEY) }).toEqual({ lang, value: translations['en'][PROBE_KEY] });
    }
  });
});