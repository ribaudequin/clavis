// @vitest-environment jsdom
// The Credits panel is the only screen in the app that is mostly signage: eleven brand
// marks, a heart, a close cross and a copy glyph, every one of them decorative because the
// text next to it already says what it says. A graphic that is not marked decorative reaches
// a screen reader as an unlabelled image, and the panel announces a list of nothing between
// every sentence. The regression this file stops is a new icon added without the attribute —
// which is why the assertion is structural (every graphic in the dialog) rather than a count.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

vi.mock('../src/renderer/hooks/useFocusTrap', () => ({ useFocusTrap: () => {} }));
vi.mock('../src/renderer/hooks/useModalKeyboard', () => ({ useModalKeyboard: () => {} }));

import CreditsModal from '../src/renderer/components/CreditsModal';

function installStub(): void {
  window.electronAPI = {
    ...window.electronAPI,
    checkUpdate: async () => null,
    getAppVersion: async () => '0.0.0-test',
  } as Window['electronAPI'];
}

/** Every graphic in the panel: inline SVG (brand marks, glyphs) and, should one ever be
 *  added, an `<img>`. Both are announcements waiting to happen. */
function graphics(): Element[] {
  return Array.from(document.querySelectorAll('svg, img'));
}

beforeEach(() => {
  installStub();
});

afterEach(() => {
  cleanup();
});

describe('CreditsModal — decorative graphics are hidden from the accessibility tree', () => {
  it('renders at least one graphic, so the assertion below is not vacuous', () => {
    render(<CreditsModal isOpen onClose={() => {}} />);

    expect(graphics().length).toBeGreaterThan(0);
  });

  it('marks every graphic either aria-hidden or as an image with alternative text', () => {
    render(<CreditsModal isOpen onClose={() => {}} />);

    const unnamed = graphics()
      .filter((graphic) => {
        const hidden = graphic.getAttribute('aria-hidden') === 'true';
        // An `<img>` with a real `alt` speaks for itself and must not be hidden; a
        // decorative `<img>` uses `alt=""` and is already out of the tree.
        const described = graphic.tagName.toLowerCase() === 'img' && graphic.hasAttribute('alt');
        return !hidden && !described;
      })
      .map((graphic) => graphic.outerHTML.slice(0, 120));

    expect(unnamed).toEqual([]);
  });

  it('gives every control in the panel an accessible name of its own', () => {
    render(<CreditsModal isOpen onClose={() => {}} />);

    const unnamed = Array.from(document.querySelectorAll('button, a[href]'))
      .filter((control) => {
        const label = control.getAttribute('aria-label')?.trim();
        const text = control.textContent?.trim();
        return !label && !text;
      })
      .map((control) => control.outerHTML.slice(0, 120));

    // The icons are hidden *because* the names come from elsewhere; this is the other half
    // of that bargain, and it fails if an icon-only button ever loses its aria-label.
    expect(unnamed).toEqual([]);
  });
});
