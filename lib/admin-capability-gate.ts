import type { DecodedIdToken } from 'firebase-admin/auth';

import { hasCapability, isAdminToken } from '@/lib/admin-auth';
import type { Capability } from '@/lib/admin-roles';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * LEGACY_ADMIN_FALLBACK: an admin session whose token has no `roles` key at all (absent or
 * undefined) is treated as the full-access admin it was before roles existed. It exists only because
 * `scripts/admin-migrate-roles.ts --apply` has not been run (.agent/memory/project/
 * needs-human.md), so every working admin today is exactly such an account and strict
 * enforcement would lock them all out of door check-in and the exports.
 *
 * It is NOT a bypass for role-bearing accounts: the moment a `roles` claim exists (null, a
 * string, an array, or the empty one left by a revoke) the capability is enforced strictly, so a door-staff account stays
 * restricted. REMOVE this fallback, and the branch below, once the migration has been applied.
 *
 * Only the four admin data routes (export-csv, newsletter export-csv, tickets list, checkin)
 * call this gate; the comp, vendor and settings routes keep calling `hasCapability()` directly.
 */
export function hasLegacyAdminFallback(decodedToken: DecodedIdToken): boolean {
  if (!isAdminToken(decodedToken)) return false;
  // Only a missing key counts: every writer of the claim omits it or writes an object, never null.
  return decodedToken.roles === undefined;
}

/**
 * The capability step the admin data routes run after `getAdminSession()` succeeds (which has
 * already proved admin:true, a verified email and the allowlist). Otherwise the same
 * `hasCapability()` + real show-window lookup the comp, settings and vendor routes use, so a
 * per-show role grant is honoured exactly as it is there. A signed-in admin without the
 * capability gets the caller's 403; it is never collapsed into the session check.
 */
export async function adminHasCapability(
  decodedToken: DecodedIdToken,
  capability: Capability
): Promise<boolean> {
  if (hasLegacyAdminFallback(decodedToken)) return true;
  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  return hasCapability(decodedToken, NATIONAL_SHOW_ID, capability, { now, lookupShowWindow });
}
