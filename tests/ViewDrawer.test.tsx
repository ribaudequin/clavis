// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

beforeEach(() => cleanup());
afterEach(() => cleanup());

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));
// The ceilings are mocked for two reasons, both stated below: 90% and 100% become
// reachable with three-digit strings instead of ten-megabyte ones, and the two are given
// *different* values so a swap between the unit the character counter reports and the
// unit the byte counter reports cannot hide behind them being equal in the real module.
vi.mock('../src/shared/limits', () => ({
  MAX_CONTENT_CODE_POINTS: 2_000,
  MAX_PLAINTEXT_BYTES: 1_000,
  countCodePoints: (s: string) => {
    let count = 0;
    for (let i = 0; i < s.length; ) {
      const cp = s.codePointAt(i) ?? 0;
      count++;
      i += cp > 0xffff ? 2 : 1;
    }
    return count;
  },
}));
import ViewDrawer from '../src/renderer/pages/ViewDrawer';
import { Result } from '../src/shared/types';
import { MAX_CONTENT_CODE_POINTS, MAX_PLAINTEXT_BYTES } from '../src/shared/limits';
import { translations } from '../src/i18n';

const BACK_BUTTON = /←\s*(back|voltar)/i;
const SAVE_AND_LEAVE = /save and leave|guardar e sair/i;
const DISCARD_AND_LEAVE = /discard and leave|descartar e sair/i;
const CANCEL = /^(cancel|cancelar)$/i;
const SAVE_DRAWER = /save drawer|guardar e voltar/i;
const UNSAVED_TITLE = /unsaved changes|alterações por guardar/i;

const okSave = async (): Promise<Result<void>> => ({ ok: true, data: undefined });
const okDelete = async (): Promise<Result<void>> => ({ ok: true, data: undefined });

function renderDrawer(overrides: Partial<React.ComponentProps<typeof ViewDrawer>> = {}) {
  const props = {
    drawerId: '1',
    password: 'pw',
    initialTitle: 'My Drawer',
    initialContent: 'Hello',
    onSave: vi.fn(okSave),
    onDelete: vi.fn(okDelete),
    onBack: vi.fn(),
    ...overrides,
  };
  const view = render(<ViewDrawer {...props} />);
  return { ...view, props };
}

describe('ViewDrawer', () => {
  it('renders title and content inputs', () => {
    renderDrawer();
    expect(screen.getByDisplayValue('My Drawer')).toBeTruthy();
    expect(screen.getByDisplayValue('Hello')).toBeTruthy();
  });

  it('calls onBack when back clicked', () => {
    const onBack = vi.fn();
    renderDrawer({ onBack });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(onBack).toHaveBeenCalled();
  });

  it('calls onSave with updated data', async () => {
    const onSave = vi.fn(okSave);
    renderDrawer({ initialTitle: 'T', initialContent: 'C', onSave });
    fireEvent.change(screen.getByDisplayValue('T'), { target: { value: 'Updated' } });
    fireEvent.change(screen.getByDisplayValue('C'), { target: { value: 'Updated content' } });
    await fireEvent.click(screen.getByRole('button', { name: SAVE_DRAWER }));
    expect(onSave).toHaveBeenCalledWith('1', 'pw', 'Updated', 'Updated content');
  });

  it('shows delete button', () => {
    renderDrawer({ initialTitle: 'Del', initialContent: '' });
    expect(screen.getByRole('button', { name: /delete drawer|eliminar gaveta/i })).toBeTruthy();
  });

  it('leaves straight away on back when the content is clean', () => {
    const { props } = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks before leaving when the title was edited', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: UNSAVED_TITLE })).toBeTruthy();
  });

  it('asks before leaving when only the content was edited', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Edited content' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('discards the edits and leaves when "discard and leave" is chosen', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: DISCARD_AND_LEAVE }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves the edits and leaves when "save and leave" is chosen', async () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.change(screen.getByDisplayValue('Hello'), { target: { value: 'Edited content' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: SAVE_AND_LEAVE }));

    await waitFor(() => expect(props.onBack).toHaveBeenCalledTimes(1));
    expect(props.onSave).toHaveBeenCalledWith('1', 'pw', 'Edited', 'Edited content');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('closes the dialog without leaving or saving when cancelled', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    fireEvent.click(screen.getByRole('button', { name: CANCEL }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(props.onBack).not.toHaveBeenCalled();
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('Edited')).toBeTruthy();
  });

  it('leaves straight away once the edit is reverted to the original value', () => {
    const { props } = renderDrawer();
    fireEvent.change(screen.getByDisplayValue('My Drawer'), { target: { value: 'Edited' } });
    fireEvent.change(screen.getByDisplayValue('Edited'), { target: { value: 'My Drawer' } });
    fireEvent.click(screen.getByRole('button', { name: BACK_BUTTON }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls handleSave when Ctrl+S is pressed on the main area', () => {
    const onSave = vi.fn(okSave);
    renderDrawer({ initialTitle: 'T', initialContent: 'C', onSave });
    fireEvent.change(screen.getByDisplayValue('T'), { target: { value: 'Updated' } });
    // Ctrl+S (metaKey covers Command on macOS)
    fireEvent.keyDown(screen.getByRole('main'), { ctrlKey: true, metaKey: true, key: 's' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('1', 'pw', 'Updated', 'C');
  });

  // SAV-01 in the UI: the counter compares against the code-point cap while the save is
  // refused by the byte cap, so the number the drawer is judged on has to be the number
  // the byte cap measures. Everything below asserts the rendered copy verbatim, so the
  // locale is pinned rather than inherited (t() short-circuits to English under CI).
  describe('capacity counter', () => {
    const ORIGINAL_LANGUAGE = window.navigator.language;
    // 'O' + 'l' + U+00E1 (2 bytes) + ' ' + U+1F600 (4 bytes, 1 code point, 2 UTF-16
    // units) + ' ' + 'a' + U+0303 (2 bytes, 2 code points, 1 grapheme) = 8 code points
    // and 13 bytes. Escapes, not literals: an invisible combining mark typed straight
    // into the source is a character nobody reviewing the diff can see.
    const MIXED = 'Ol\u00e1 \u{1F600} a\u0303';
    const MIXED_CODE_POINTS = 8;
    const MIXED_BYTES = 13;

    // Independent of the component's formatNumber(), on purpose: asserting the source's
    // own formatter against itself proves nothing. beforeEach pins en-US, and
    // detectLocale() short-circuits to 'en', so 'en' is what the component formats with.
    const en = (n: number): string => new Intl.NumberFormat('en').format(n);
    const pt = (n: number): string => new Intl.NumberFormat('pt-PT').format(n);

    function setLanguage(lang: string): void {
      Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });
    }

    // The bar is the only element carrying one of these three classes.
    function capacityBar(container: HTMLElement): HTMLElement {
      const bar = container.querySelector<HTMLElement>('.bg-green-500, .bg-amber-500, .bg-red-600');
      if (!bar) throw new Error('capacity bar not found');
      return bar;
    }

    beforeEach(() => {
      vi.stubEnv('CI', undefined);
      setLanguage('en-US');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      setLanguage(ORIGINAL_LANGUAGE);
    });

    // A mistyped mock lands on the test, not the source, and produces a green run that
    // proves nothing: if this factory ever stops applying, every other test below still
    // passes while asserting nothing about the component.
    it('runs against the mocked ceilings the thresholds are computed from', () => {
      expect({ codePoints: MAX_CONTENT_CODE_POINTS, bytes: MAX_PLAINTEXT_BYTES }).toEqual({
        codePoints: 2_000,
        bytes: 1_000,
      });
    });

    it('shows the character and byte counts for text whose two units disagree', () => {
      renderDrawer({ initialContent: MIXED });
      expect(screen.getByText(new RegExp(`^${MIXED_CODE_POINTS} characters$`))).toBeTruthy();
      expect(screen.getByText(new RegExp(`^${MIXED_BYTES} / ${en(MAX_PLAINTEXT_BYTES)} `))).toBeTruthy();
    });

    it('counts code points, not grapheme clusters', () => {
      // Both inputs are 2 code points and 1 grapheme, so counting grapheme clusters —
      // which is what this component used to do — lands on a different number than the
      // code-point count the save schema enforces.
      const cases: { input: string; codePoints: number; graphemes: number }[] = [
        { input: 'a\u0303', codePoints: 2, graphemes: 1 },
        { input: '\u{1F1E7}\u{1F1F9}', codePoints: 2, graphemes: 1 },
      ];
      for (const { input, codePoints, graphemes } of cases) {
        cleanup();
        renderDrawer({ initialContent: input });
        const counter = screen.getByText(/^\d+ characters$/);
        const shown = Number((counter.textContent ?? '').split(' ')[0]);
        expect({ input, shown, codePoints, differsFromGraphemes: shown !== graphemes }).toEqual({
          input,
          shown: codePoints,
          codePoints,
          differsFromGraphemes: true,
        });
      }
    });

    // The code-point ceiling can never refuse a save: every code point costs 1-4 UTF-8
    // bytes, so passing the byte cap implies passing it. Only the byte counter is a limit.
    it('gives the ceiling to the byte counter only, and shows characters as a bare count', () => {
      renderDrawer({ initialContent: 'x'.repeat(10) });
      expect(screen.getByText(/^10 characters$/)).toBeTruthy();
      expect(screen.getByText(new RegExp(`^10 / ${en(MAX_PLAINTEXT_BYTES)} bytes$`))).toBeTruthy();
      expect(screen.queryByText(new RegExp(`${en(MAX_CONTENT_CODE_POINTS)}`))).toBeNull();
    });

    // The old layout put both counters against a ceiling, so a note in accented
    // Portuguese read "half full" beside a full red bar. The character count must never
    // carry the risk colouring that the byte count does.
    it('escalates the byte count but never the character count', () => {
      const { unmount } = renderDrawer({ initialContent: 'x'.repeat(10) });
      expect(screen.getByText(/^10 characters$/).className).not.toContain('text-amber-600');
      expect(screen.getByText(/bytes$/).className).not.toContain('text-amber-600');

      for (const n of [900, MAX_PLAINTEXT_BYTES]) {
        unmount();
        renderDrawer({ initialContent: 'x'.repeat(n) });
        expect(screen.getByText(new RegExp(`^${en(n)} characters$`)).className).not.toContain('text-amber-600');
        expect(screen.getByText(new RegExp(`^${en(n)} / ${en(MAX_PLAINTEXT_BYTES)} bytes$`)).className).toContain('text-amber-600');
      }
    });

    it('shows the byte percentage next to the bar, rounded', () => {
      const { container, unmount } = renderDrawer({ initialContent: 'x'.repeat(445) });
      expect(screen.getByText('45%')).toBeTruthy();
      expect(capacityBar(container).style.width).toBe('45%');
      unmount();
      renderDrawer({ initialContent: 'x'.repeat(5) });
      expect(screen.getByText('1%')).toBeTruthy();

      // Rounding pinned from both sides. At exactly 44.5% round() and ceil() agree, so a
      // single boundary case cannot tell them apart: 44.1% separates round from ceil and
      // 44.9% separates round from floor.
      for (const [bytes, expected] of [[441, '44%'], [449, '45%']] as const) {
        cleanup();
        const view = renderDrawer({ initialContent: 'x'.repeat(bytes) });
        expect({ bytes, label: screen.getByText(expected).textContent, width: capacityBar(view.container).style.width })
          .toEqual({ bytes, label: expected, width: expected });
      }
      renderDrawer({ initialContent: 'x'.repeat(MAX_PLAINTEXT_BYTES) });
      expect(screen.getByText('100%')).toBeTruthy();
    });

    it('keeps the bar green below 90% of the byte ceiling and stays silent about the limit', () => {
      const { container } = renderDrawer({ initialContent: 'x'.repeat(890) });
      expect(capacityBar(container).className).toContain('bg-green-500');
      expect(capacityBar(container).style.width).toBe('89%');
      expect(screen.queryByText(new RegExp(`^Limit: ${en(890)} / ${en(MAX_PLAINTEXT_BYTES)} bytes\\.$`))).toBeNull();
      expect(screen.getByText(new RegExp(`^${en(890)} / ${en(MAX_PLAINTEXT_BYTES)} bytes$`)).className).not.toContain('text-amber-600');
    });

    it('turns the bar and the counters amber at 90% of the byte ceiling', () => {
      const { container } = renderDrawer({ initialContent: 'x'.repeat(900) });
      expect(capacityBar(container).className).toContain('bg-amber-500');
      expect(capacityBar(container).style.width).toBe('90%');
      expect(screen.getByText(new RegExp(`^${en(900)} / ${en(MAX_PLAINTEXT_BYTES)} bytes$`)).className).toContain('text-amber-600');
      expect(screen.queryByText(new RegExp(`^Limit: ${en(900)} / ${en(MAX_PLAINTEXT_BYTES)} bytes\\.$`))).toBeNull();
    });

    it('turns the bar red at the byte ceiling and reveals the limit line', () => {
      const { container } = renderDrawer({ initialContent: 'x'.repeat(MAX_PLAINTEXT_BYTES) });
      expect(capacityBar(container).className).toContain('bg-red-600');
      expect(capacityBar(container).style.width).toBe('100%');
      expect(screen.getByText(`Limit: ${en(MAX_PLAINTEXT_BYTES)} / ${en(MAX_PLAINTEXT_BYTES)} bytes.`)).toBeTruthy();
    });

    // The locale decides the digit grouping, and it is NOT a detail: pt-PT writes
    // 4-digit numbers bare ("2000") and groups from 5 digits up ("10 000 000"), while en
    // groups at 4 ("2,000"). Read textContent raw on purpose — getByText's normaliser
    // collapses \s+, and \s matches U+00A0, so a normaliser-blind assertion would pass
    // on a plain space and pin nothing about the separator.
    it('groups the digits for the active locale rather than printing them bare', () => {
      // The LIVE count has to cross the grouping boundary too, not just the ceiling: at
      // 1, 2, 8 or 10 characters formatNumber(n) and String(n) are the same string, so a
      // mutation swapping one for the other stays green. 2000 crosses it in en.
      renderDrawer({ initialContent: 'x'.repeat(2000) });
      expect(screen.getByText(/characters$/).textContent).toBe(`${en(2000)} characters`);

      cleanup();
      renderDrawer({ initialContent: 'x' });
      expect(screen.getByText(/characters$/).textContent).toBe('1 characters');

      cleanup();
      setLanguage('pt-PT');
      renderDrawer({ initialContent: 'x'.repeat(2000) });
      expect(screen.getByText(/caracteres$/).textContent).toBe('2000 caracteres');

      cleanup();
      renderDrawer({ initialContent: 'x' });
      expect(screen.getByText(/caracteres$/).textContent).toBe('1 caracteres');

      cleanup();
      setLanguage('en-US');
      renderDrawer({ initialContent: 'x' });
      expect(screen.getByText(/characters$/).textContent).toBe('1 characters');
    });

    // The value the user actually reads at the real ceiling, formatted by the platform for
    // each locale. Measured on this box's ICU: pt-PT uses U+00A0, en uses a comma.
    it('formats the real 10 MB ceiling with the locale separator, verified per locale', () => {
      expect({
        'pt-PT': new Intl.NumberFormat('pt-PT').format(10_000_000),
        en: new Intl.NumberFormat('en').format(10_000_000),
      }).toEqual({ 'pt-PT': '10\u00a0000\u00a0000', en: '10,000,000' });
    });

    it('interpolates the byte ceiling into the limit line, in both locales', () => {
      const { unmount } = renderDrawer({ initialContent: 'x'.repeat(MAX_PLAINTEXT_BYTES) });
      expect(screen.getByText(new RegExp(`${en(MAX_PLAINTEXT_BYTES)} / ${en(MAX_PLAINTEXT_BYTES)} bytes\\.`))).toBeTruthy();
      unmount();
      setLanguage('pt-PT');
      renderDrawer({ initialContent: 'x'.repeat(MAX_PLAINTEXT_BYTES) });
      expect(screen.getByText(new RegExp(`(Limit|Limite): ${pt(MAX_PLAINTEXT_BYTES)} / ${pt(MAX_PLAINTEXT_BYTES)} bytes\\.`))).toBeTruthy();
    });

    it('takes the ceiling out of the dictionaries so it cannot drift from the constant', () => {
      for (const locale of ['pt-PT', 'en'] as const) {
        const atLimit = translations[locale]['label.at_limit'];
        // No digits at all: the template cannot name a number it does not interpolate.
        expect({ locale, hasDigits: /\d/.test(atLimit), usesMax: atLimit.includes('{max}') }).toEqual({
          locale,
          hasDigits: false,
          usesMax: true,
        });
        // The character count carries no ceiling at all, so it must not even have the
        // placeholder: a stray {max} here is how the misleading "half full" came back.
        expect({
          locale,
          usesMax: translations[locale]['label.characters'].includes('{max}'),
          bytesUsesMax: translations[locale]['label.bytes'].includes('{max}'),
        }).toEqual({ locale, usesMax: false, bytesUsesMax: true });
        expect({ locale, percent: translations[locale]['label.percent'] })
          .toEqual({ locale, percent: '{pct}%' });
        // The old key called this a token, which it never was: an LLM token is roughly
        // four characters, and the count was being compared against a ceiling that can
        // never refuse a save.
        expect({ locale, stale: Object.keys(translations[locale]).includes('label.tokens') }).toEqual({
          locale,
          stale: false,
        });
      }
      expect({ en: translations['en']['label.characters'], pt: translations['pt-PT']['label.characters'] })
        .toEqual({ en: '{cp} characters', pt: '{cp} caracteres' });
    });

    it('does not recount the content when an unrelated field changes', () => {
      const encode = vi.spyOn(TextEncoder.prototype, 'encode');
      renderDrawer({ initialTitle: 'T', initialContent: 'abc' });
      const afterMount = encode.mock.calls.length;
      fireEvent.change(screen.getByDisplayValue('T'), { target: { value: 'Renamed' } });
      expect({ afterMount, afterUnrelatedEdit: encode.mock.calls.length }).toEqual({
        afterMount,
        afterUnrelatedEdit: afterMount,
      });
      // Guards the comparison above from passing vacuously: the content is encoded once
      // on mount and not again.
      expect(afterMount).toBe(1);
    });

    it('keeps the two real ceilings equal in value while named as different units', async () => {
      // Tripwire: the ceilings are equal by design, and the rendered UI shows whichever
      // one reaches it. A deliberate raise has to update this line, not drift past it.
      const actual = await vi.importActual<typeof import('../src/shared/limits')>('../src/shared/limits');
      expect({
        codePoints: actual.MAX_CONTENT_CODE_POINTS,
        bytes: actual.MAX_PLAINTEXT_BYTES,
        equal: actual.MAX_CONTENT_CODE_POINTS === actual.MAX_PLAINTEXT_BYTES,
      }).toEqual({ codePoints: 10_000_000, bytes: 10_000_000, equal: true });
    });
  });
});
