/**
 * F4 (ticketing-foundation) — orphan-role detection for `scripts/admin-list.ts`. Flags any role
 * name held by a live account's `roles` claim that no longer exists in `lib/admin-roles.ts`'s
 * mapping (e.g. after a role rename — spec §5.6's rename procedure). Checked live against
 * `ROLE_NAMES`, not a copy of it, so a future rename is caught here without editing this file.
 */

import { ROLE_NAMES } from './admin-roles';
import type { RolesClaim } from './admin-auth';

/** Deduplicated list of role-name strings held anywhere in the claim that aren't recognised. */
export function findOrphanRoles(roles: RolesClaim | undefined): string[] {
  if (!roles) return [];

  const recognised = new Set<string>(ROLE_NAMES);
  const orphans = new Set<string>();

  for (const roleNames of Object.values(roles)) {
    for (const name of roleNames) {
      if (!recognised.has(name)) {
        orphans.add(name);
      }
    }
  }

  return [...orphans];
}
