// HYG-8 — countCodePoints must not allocate a per-code-point array at the ceiling.
//
// The previous version of this file asserted `countCodePoints(value) === MAX` and
// `typeof result === 'number'`. Both stay true if the implementation is reverted to
// `[...value].length` — the exact regression the file is named after — so it proved
// nothing. `[...value]` consumes `String.prototype[Symbol.iterator]`; a code-point
// scan built on `codePointAt` does not. That is the observable difference, and it is
// what these tests pin. HYG-21 sub-item (1).

import { describe, it, expect, vi } from 'vitest';
import {
  MAX_CONTENT_CODE_POINTS,
  MAX_PLAINTEXT_BYTES,
  countCodePoints,
} from '../src/shared/limits';

describe('HYG-8 — allocation at the limit (store-limit.allocation)', () => {
  it('counts code points without going through the string iterator', () => {
    const iterator = vi.spyOn(String.prototype, Symbol.iterator);
    try {
      // Surrogate pair: one code point, two UTF-16 units. A length- or
      // grapheme-based count lands on a different number.
      expect(countCodePoints('a\u{1F600}b')).toBe(3);
      expect(iterator).not.toHaveBeenCalled();
    } finally {
      iterator.mockRestore();
    }
  });

  it('scans the full ceiling without materialising a per-code-point array', () => {
    const iterator = vi.spyOn(String.prototype, Symbol.iterator);
    try {
      const value = 'x'.repeat(MAX_CONTENT_CODE_POINTS);
      expect(countCodePoints(value)).toBe(MAX_CONTENT_CODE_POINTS);
      // The regression this guards: `[...value].length` would call the iterator
      // exactly once and build a 10 M-element array on the UI thread.
      expect(iterator).not.toHaveBeenCalled();
    } finally {
      iterator.mockRestore();
    }
  });

  it('documents the byte side of SAV-01: the dense array is the accepted cost', () => {
    // TextEncoder.encode returns one dense byte buffer, not one entry per code
    // point, and the component memoises it on `content`. This is a statement
    // about the accepted cost, not a guard on countCodePoints.
    const value = 'x'.repeat(MAX_CONTENT_CODE_POINTS);
    const bytes = new TextEncoder().encode(value).length;

    expect(bytes).toBe(MAX_CONTENT_CODE_POINTS);
    expect(bytes).toBeLessThanOrEqual(MAX_PLAINTEXT_BYTES);
  });
});
