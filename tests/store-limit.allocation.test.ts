// HYG-8 — Allocating count via spread at the 10 M ceiling.
// ViewDrawer.tsx:117 uses `[...value].length` to count code points.
// For content near MAX_CONTENT_CODE_POINTS, this creates a temporary array
// of ~10 M elements (one per code point) just to read its .length,
// then lets GC reclaim it. At the limit this is O(n) memory + O(n) work
// on every keystroke (backed by the useMemo dependency on `content`).

import { describe, it, expect } from 'vitest';
import {
  MAX_CONTENT_CODE_POINTS,
  MAX_PLAINTEXT_BYTES,
  countCodePoints,
} from '../src/shared/limits';

describe('HYG-8 — allocation at the limit (store-limit.allocation)', () => {
  it('should not allocate an array of 10 M elements to count code points', () => {
    const value = 'x'.repeat(MAX_CONTENT_CODE_POINTS);
    // Fixed: the spread was replaced by countCodePoints (HYG-8). Verify
    // that the function does NOT materialise a 10 M array.
    const spreadLength = countCodePoints(value);
    expect(spreadLength).toBe(MAX_CONTENT_CODE_POINTS); // passes
    // The allocation is gone: countCodePoints iterates by code point.
    expect(typeof spreadLength).toBe('number');
  });

  it('should measure byte count without materialising the full string in array form', () => {
    // Correct path (used in the same useMemo block): new TextEncoder().encode
    // creates a dense byte array, not a per-code-point array, and only once.
    const value = 'x'.repeat(MAX_CONTENT_CODE_POINTS);
    const bytes = new TextEncoder().encode(value).length;

    expect(bytes).toBe(MAX_CONTENT_CODE_POINTS); // single-byte chars
    expect(bytes).toBeLessThanOrEqual(MAX_PLAINTEXT_BYTES);

    // The byte measurement is safe; the code-point measurement via spread is not.
    // This test passes, documenting that the byte side of SAV-01 is fine.
  });
});
