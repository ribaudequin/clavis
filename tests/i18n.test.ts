import { describe, it, expect, vi, afterEach } from 'vitest';
import { translations, t, resolveLocale, applyDocumentLanguage } from '../src/i18n';
import { PASSWORD_MIN_LENGTH, PASSPHRASE_MIN_LENGTH } from '../src/shared/password-policy';
import * as fs from 'fs';
import * as path from 'path';

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

// HYG-23 — `process.env.CI` is no longer stubbed here. It was, to neutralise a
// short-circuit that no longer exists: `detectLocale()` used to open with
// `if (process.env.CI) return 'en';`, which was dead code in every packaged build
// (Vite rewrites `process.env` to `{}`) and unnecessary in the tests (jsdom's
// `navigator.language` is always 'en-US', and the tests that care pin it themselves).
// Nothing reads the variable now, so stubbing it would only be a trace of a branch
// that is gone — and the guard that keeps it gone is at the bottom of this file.

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

// SEC-08 — The rule has two branches, and the sentence the user reads is half the
// rule if it names only one of them. The thresholds are read from the shared module
// rather than restated here, because a test that carries its own numbers stops
// being a guard the moment the constants move: it would still pass against a
// sentence that had fallen behind the code.
describe('the password policy message', () => {
  it('names both thresholds in both catalogues, read from the shared policy', () => {
    const expected = [String(PASSWORD_MIN_LENGTH), String(PASSPHRASE_MIN_LENGTH)].sort();
    for (const locale of LOCALES) {
      for (const key of ['msg.password_too_short', 'error.password_too_short']) {
        const value = translations[locale][key];
        // Every number the sentence carries is one of the two thresholds: a third
        // one would be a threshold the code does not enforce — which is exactly
        // what the stale 8-character rule looked like.
        const numbers = (value.match(/\d+/g) ?? []).sort();
        expect({ locale, key, numbers }).toEqual({ locale, key, numbers: expected });
      }
    }
  });

  it('states the same rule in both catalogues', () => {
    // The two catalogues are not two wordings of one message: a translation that
    // dropped the passphrase branch would leave an English user with a policy the
    // app does not enforce.
    const pt = translations['pt-PT']['msg.password_too_short'];
    const en = translations['en']['msg.password_too_short'];
    expect(pt).not.toBe(en);
    for (const locale of LOCALES) {
      expect(translations[locale]['msg.password_too_short']).toBe(
        translations[locale]['error.password_too_short'],
      );
    }
  });
});

// UX-02 — The strength meter's labels were hardcoded Portuguese in the component
// while every other string in it went through t(), so the meter was the one place
// in the app that could not be translated. The scan is the structural half of that:
// the component must name its labels through catalogue keys, and must not carry the
// label text itself. The count guard keeps the scan from passing on an empty
// result if the pattern ever stops matching.
describe('the strength meter labels', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'renderer', 'components', 'CreateDrawerModal.tsx'),
    'utf8',
  );

  it('are named through catalogue keys in the component', () => {
    const labelKeys = source.match(/label\.strength_[a-z_]+/g) ?? [];
    expect(labelKeys.length).toBeGreaterThanOrEqual(5);
    expect(new Set(labelKeys).size).toBe(labelKeys.length);
  });

  it('are not carried as literals in the component', () => {
    for (const literal of [
      'Muito curta',
      'Muito simples',
      'Fraca',
      'Razoável',
      'Boa',
      'Forte',
      'Excelente',
      'Too short',
      'Too simple',
      'Weak',
      'Fair',
      'Good',
      'Strong',
      'Excellent',
    ]) {
      const carried = new RegExp(`['"]${literal}['"]`).test(source);
      expect({ literal, carried }).toEqual({ literal, carried: false });
    }
  });

  it('exist in both catalogues', () => {
    for (const key of [
      'label.strength_too_short',
      'label.strength_too_simple',
      'label.strength_good',
      'label.strength_strong',
      'label.strength_excellent',
    ]) {
      for (const locale of LOCALES) {
        expect({ locale, key, value: translations[locale][key] }).toEqual({
          locale,
          key,
          value: expect.any(String),
        });
      }
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

  it('answers from the language tag alone, whatever the environment holds', () => {
    vi.stubEnv('CI', 'true');
    expect(resolveLocale('pt-PT')).toBe('pt-PT');
    expect(resolveLocale('en-US')).toBe('en');
  });

  // HYG-23 — The test above was misleading, and it is worth saying why, because the
  // mistake it made is the mistake the whole item was about. It claimed that the
  // locale decision "carries no CI short-circuit", and it asserted that against
  // `resolveLocale` — the pure function, which never had one. The short-circuit lived
  // in `detectLocale()`, the function the app actually calls, and *that* function did
  // answer differently under CI until 2026-10-22. The assertion was true of a function
  // that could not have been wrong, and silent about the one that was.
  //
  // So the guard is stated against the real decision path: the rendered string.
  it('renders the same language with CI set and with it unset', () => {
    const PROBE = 'label.credits_title';
    setLanguage('pt-PT');
    vi.stubEnv('CI', undefined);
    const withoutCi = t(PROBE);
    vi.stubEnv('CI', 'true');
    const withCi = t(PROBE);

    expect({ withCi, withoutCi }).toEqual({
      withCi: translations['pt-PT'][PROBE],
      withoutCi: translations['pt-PT'][PROBE],
    });
    // The count guard: the probe has to be one whose two catalogues differ, or the
    // comparison above would hold under any locale decision at all.
    expect(translations['en'][PROBE]).not.toBe(translations['pt-PT'][PROBE]);
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

// HYG-23 — The structural half of the guard: the renderer must hold no CI override.
//
// The behavioural guard above proves the *rendered* language does not change when CI
// is set, and it would catch the branch coming back. This one catches what it cannot:
// an override through some *other* environment variable, and the general shape of the
// problem — a branch that is dead in a packaged build, because Vite rewrites
// `process.env` to `{}`, reads in the source like a feature and the next reader
// trusts it. That branch was in the shipped bundle as `{}.CI ? 'en' : …`, a constant
// undefined, for months.
//
// The scan reads the CODE, not the prose: the source's own note about the removed
// branch quotes it verbatim, and a scan that read the comment would forbid the very
// explanation of why the branch is gone. Both halves of that are proved below.
describe('the renderer holds no CI override', () => {
  const I18N_SOURCE = path.resolve(__dirname, '..', 'src', 'i18n', 'index.ts');
  const source = fs.readFileSync(I18N_SOURCE, 'utf8');

  function codeOnly(text: string): string {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
  }

  function envReadsIn(text: string): number {
    return (codeOnly(text).match(/process\.env/g) ?? []).length;
  }

  it('sees an environment read in code — the count guard', () => {
    const FIXTURE = [
      'function detectLocale(): Locale {',
      "  if (process.env.CI) return 'en';",
      '}',
    ].join('\n');
    expect(envReadsIn(FIXTURE)).toBe(1);
  });

  it('ignores an environment read that only appears in a comment', () => {
    const FIXTURE = [
      '// This used to open with `if (process.env.CI) return \'en\';`.',
      'function detectLocale(): Locale {',
      "  return resolveLocale(navigator.language || 'en');",
      '}',
    ].join('\n');
    expect(envReadsIn(FIXTURE)).toBe(0);
  });

  it('holds no environment read of any kind, so no other override can hide in here', () => {
    // Narrow on purpose: `process.env` in the *main* process is a different thing
    // (src/main/ipc-handlers.ts reads LANG for two log strings), and this file is the
    // renderer's. What must not exist here is a second way to decide the locale.
    expect(envReadsIn(source)).toBe(0);
  });
});
