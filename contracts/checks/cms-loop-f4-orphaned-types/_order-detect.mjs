// F4 (cms-loop-and-wiring): shared, network-free logic for detecting the RENDERED
// order of award codes in a page's HTML body. Factored out so
// check-order-detector-selftest.mjs (A4) can prove this logic isn't vacuously true
// BEFORE check-award-order-reaches-site.mjs (A2) trusts it against a real live page —
// same "prove the detector first" discipline as F6/F2's negative controls, applied to
// a position-comparison detector instead of a simple substring match.

// Returns `codes` sorted by their first-appearance index in `html`, ascending
// (earliest-appearing first). A code not found in `html` at all is dropped from the
// result (never silently assigned a position) — callers must check
// `result.length === codes.length` if completeness matters.
export function renderedOrder(html, codes) {
  const found = codes
    .map((code) => ({ code, index: html.indexOf(code) }))
    .filter((entry) => entry.index !== -1);
  found.sort((a, b) => a.index - b.index);
  return found.map((entry) => entry.code);
}

// True if `code` is the LAST element of `codes` as rendered in `html` — i.e. every
// other code in `codes` that appears in `html` appears at an earlier index. Requires
// ALL of `codes` to be present (a missing code fails closed, not silently ignored),
// since "is X last" is meaningless if we can't see the rest of the sequence.
export function isRenderedLast(html, code, codes) {
  const order = renderedOrder(html, codes);
  if (order.length !== codes.length) return false;
  return order[order.length - 1] === code;
}

// True if `code` is the FIRST element, same completeness requirement as above.
export function isRenderedFirst(html, code, codes) {
  const order = renderedOrder(html, codes);
  if (order.length !== codes.length) return false;
  return order[0] === code;
}
