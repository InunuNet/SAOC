// Cache-Control classifier shared by cache-headers-probe.mjs and its regression test.
// A header value passes a class when it matches `must_match` and does not match `must_not_match`.
// A missing header never passes. Cache-Control directives are case-insensitive (RFC 9111 5.2), so
// both patterns compile with the `i` flag: `Immutable` must be rejected where `immutable` is.
export function classify(rule, cacheControl) {
  if (cacheControl === null || cacheControl === undefined) return false;
  return new RegExp(rule.must_match, 'i').test(cacheControl) && !new RegExp(rule.must_not_match, 'i').test(cacheControl);
}
