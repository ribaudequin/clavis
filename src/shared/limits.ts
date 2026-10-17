// The single number behind both content ceilings, and nothing else. The two exports
// below are equal in value and deliberately different in unit:
//
//   MAX_CONTENT_CODE_POINTS — what the save schema accepts. Zod's .max() counts code
//     points, folding surrogate pairs, so '\u{1F600}' is 1.
//   MAX_PLAINTEXT_BYTES — what encrypt()/decrypt() enforce, in UTF-8 bytes, so
//     '\u{1F600}' is 4.
//
// The worst case is therefore 4 bytes per code point, and that gap is SAV-01: content
// can pass validation and then be permanently unopenable, because the byte cap refuses
// what the code-point cap admitted. Do not merge these into one constant — that hides
// the unit from the reader and turns the next limit change into a silent data-loss bug.
// See docs/DRAWER-CAPACITY.md.
const CONTENT_CEILING = 10_000_000;

export const MAX_CONTENT_CODE_POINTS = CONTENT_CEILING;
export const MAX_PLAINTEXT_BYTES = CONTENT_CEILING;

// HYG-8 fix — count code points without allocating a temporary array
// of ~10 M elements (the old `[...value].length` in ViewDrawer.tsx:117).
// Iterates by code point (handles surrogate pairs correctly) and never
// materialises an intermediate array.
export function countCodePoints(s: string): number {
  let count = 0;
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i) ?? 0;
    count++;
    i += cp > 0xffff ? 2 : 1;
  }
  return count;
}
