// Canonical sentinel-domain source of truth. See
// contracts/golden/payfast-m1-lock-cleanup-fix/sentinel-domains.golden.json and
// contracts/golden/payfast-m1-lock-cleanup-fix/README.md ("Point 3 — unified sentinel
// detection") for why this module exists: ticketing-hardening/_shared.mjs and
// d6-door-checkin/_shared.mjs each independently hardcoded their own sentinel domain
// literal, and scripts/scan-firestore-residue.ts independently retyped its own regex for
// each one — two literals for one fact is exactly the drift risk this module closes.
//
// Do not add a domain here speculatively — only when a real suite introduces one, exactly
// as 'harden-check.invalid' and 'd6-door-checkin-check.invalid' were each introduced by a
// real suite.

export const SENTINEL_DOMAINS = ['harden-check.invalid', 'd6-door-checkin-check.invalid'];

/**
 * True if `email` ends in `@<domain>` for any domain in `domains` (defaults to the
 * canonical SENTINEL_DOMAINS array). `domains` is a parameter, not a closed-over
 * constant, specifically so this function's genericity can be proven against a
 * synthetic third domain without mutating the real exported array — see
 * contracts/checks/_shared/check-sentinel-domains-generic.mjs.
 */
export function isKnownSentinelDomain(email, domains = SENTINEL_DOMAINS) {
  if (typeof email !== 'string') return false;
  const lowered = email.toLowerCase();
  return domains.some((domain) => lowered.endsWith(`@${domain.toLowerCase()}`));
}
