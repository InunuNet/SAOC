import type { DecodedIdToken } from 'firebase-admin/auth';

import { hasCapability } from '@/lib/admin-auth';
import type { Capability } from '@/lib/admin-roles';
import { resolveShowWindowLookup } from '@/lib/show-window-lookup';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';

/**
 * The capability step the admin data routes run after `getAdminSession()` succeeds: the same
 * `hasCapability()` + real show-window lookup pairing the comp, settings and vendor routes use,
 * so a per-show role grant is honoured exactly as it is there. A signed-in admin without the
 * capability gets the caller's 403; it is never collapsed into the session check.
 */
export async function adminHasCapability(
  decodedToken: DecodedIdToken,
  capability: Capability
): Promise<boolean> {
  const now = new Date();
  const lookupShowWindow = await resolveShowWindowLookup(NATIONAL_SHOW_ID, now);
  return hasCapability(decodedToken, NATIONAL_SHOW_ID, capability, { now, lookupShowWindow });
}
