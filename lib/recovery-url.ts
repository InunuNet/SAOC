/**
 * F11 (ticketing-foundation) — the F6 recovery-token deep link (spec §8.2), built as its own
 * zero-import pure function so it can be exercised by a check with no `@/*`-aliased VALUE
 * imports in its dependency graph (see the golden README's `npx tsx` vs `node --import
 * tsx/esm` section).
 *
 * Deliberately branches on `recoveryToken === null` BEFORE building any string — interpolating
 * a possibly-null token directly into the template would silently produce a broken
 * "?token=null" URL instead of no link at all.
 */
export function buildRecoveryUrl(recoveryToken: string | null, siteUrl: string): string | null {
  if (recoveryToken === null) return null;
  const normalisedSiteUrl = siteUrl.replace(/\/+$/, '');
  return `${normalisedSiteUrl}/tickets/recover?token=${encodeURIComponent(recoveryToken)}`;
}
