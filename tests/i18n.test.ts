import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { translations, t, resolveLocale, applyDocumentLanguage } from '../src/i18n';

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
  vi.doUnmock('../src/i18n');
  vi.doUnmock('react-dom/client');
  vi.doUnmock('../src/renderer/pages/HomeScreen');
  vi.doUnmock('../src/renderer/components/ErrorBoundary');
  vi.doUnmock('../src/renderer/components/ToastProvider');
  setLanguage(ORIGINAL_LANGUAGE);
  document.documentElement.removeAttribute('lang');
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

// WCAG 3.1.1 Language of Page. Measured on a published binary, not theorised:
// the v0.4.5-beta AppImage read `document.documentElement.lang === 'en'` with
// the whole UI in European Portuguese, so a screen reader pronounced every
// string on every screen with an English voice.
//
// Everything below asserts against the *attribute on the document*, not only
// against the mapping function. A test of the mapping alone passes while the
// page stays wrong, which is exactly what happened for eight days.
describe('document language (WCAG 3.1.1)', () => {
  it('maps a system language tag onto the locale the app renders', () => {
    expect(resolveLocale('pt-PT')).toBe('pt-PT');
    expect(resolveLocale('pt-BR')).toBe('pt-PT');
    expect(resolveLocale('pt')).toBe('pt-PT');
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('en')).toBe('en');
  });

  it('maps an empty or malformed tag to English rather than to nothing', () => {
    for (const lang of ['', '   ', '-', '!!!', 'not-a-locale', 'p', 'ptt-PT']) {
      expect({ lang, locale: resolveLocale(lang) }).toEqual({ lang, locale: 'en' });
    }
  });

  it('can only return a locale the dictionary actually has', () => {
    for (const lang of ['pt-PT', 'pt-BR', 'pt', 'pt_AO', 'en-US', 'en', 'fr-FR', '', '!!!']) {
      expect(Object.keys(translations)).toContain(resolveLocale(lang));
    }
  });

  it('carries no CI short-circuit of its own, so it cannot answer differently under test', () => {
    vi.stubEnv('CI', 'true');
    expect(resolveLocale('pt-PT')).toBe('pt-PT');
    expect(resolveLocale('en-US')).toBe('en');
  });

  it('writes the locale onto <html lang> for a Portuguese system language', () => {
    setLanguage('pt-PT');
    applyDocumentLanguage();
    expect(document.documentElement.getAttribute('lang')).toBe('pt-PT');
    expect(document.documentElement.lang).toBe('pt-PT');
  });

  it('writes <html lang="en"> for an English system language', () => {
    setLanguage('en-US');
    applyDocumentLanguage();
    expect(document.documentElement.getAttribute('lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('leaves the attribute agreeing with what t() actually renders, for every tag it routes', () => {
    const PROBE = 'label.credits_title';
    for (const lang of ['pt-PT', 'pt-BR', 'pt', 'pt_AO', 'en-US', 'fr-FR', '!!!']) {
      setLanguage(lang);
      applyDocumentLanguage();
      // Derived from what t() produced, not from the tag — so this fails if the
      // attribute and the rendered copy ever come from different decisions.
      const expected = t(PROBE) === translations['pt-PT'][PROBE] ? 'pt-PT' : 'en';
      expect({ lang, attribute: document.documentElement.lang, expected }).toEqual({
        lang,
        attribute: expected,
        expected,
      });
    }
  });

  // Requirement: the call must be wired into startup, not merely exported.
  // Importing the renderer entry is the only honest way to prove that, so React
  // is mocked out — what runs here is the module body, not a rendered tree.
  // The render hook is a parameter because a second `vi.doMock` on the same path
  // does not replace the first one, and that silently produced an `order` with no
  // 'render' in it on the first attempt.
  function mockRendererDependencies(onRender?: () => void): void {
    vi.doMock('../src/renderer/pages/HomeScreen', () => ({ default: () => null }));
    vi.doMock('../src/renderer/components/ErrorBoundary', () => ({ default: () => null }));
    vi.doMock('../src/renderer/components/ToastProvider', () => ({ default: () => null }));
    vi.doMock('react-dom/client', () => ({
      createRoot: () => ({
        render: () => {
          onRender?.();
        },
      }),
    }));
  }

  it('is applied by the renderer entry when the app boots under a Portuguese locale', async () => {
    mockRendererDependencies();
    setLanguage('pt-PT');
    vi.resetModules();
    await import('../src/renderer/index');
    expect(document.documentElement.getAttribute('lang')).toBe('pt-PT');
  });

  it('is applied by the renderer entry when the app boots under an English locale', async () => {
    mockRendererDependencies();
    setLanguage('en-US');
    vi.resetModules();
    await import('../src/renderer/index');
    expect(document.documentElement.getAttribute('lang')).toBe('en');
  });

  it('runs before the first render, so nothing is ever mounted under the wrong language', async () => {
    const order: string[] = [];
    mockRendererDependencies(() => {
      order.push('render');
    });
    vi.doMock('../src/i18n', async (importActual) => {
      const actual = await importActual<typeof import('../src/i18n')>();
      return {
        ...actual,
        applyDocumentLanguage: () => {
          order.push('applyDocumentLanguage');
          actual.applyDocumentLanguage();
        },
      };
    });
    setLanguage('pt-PT');
    vi.resetModules();
    await import('../src/renderer/index');
    expect({ order, attribute: document.documentElement.lang }).toEqual({
      order: ['applyDocumentLanguage', 'render'],
      attribute: 'pt-PT',
    });
  });
});
