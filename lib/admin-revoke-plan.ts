/**
 * F4 (ticketing-foundation) — the revoke plan for `scripts/admin-revoke.ts`'s role-scoped
 * revokes. See contracts/golden/ticketing-f4-roles-claim/README.md for the decision record
 * (spec §5.5, §5.4). Pure, side-effect-free — no Admin SDK, no network.
 */

import type { RolesClaim } from './admin-auth';

export interface RevokeTarget {
  role: string;
  show: string;
}

export interface RevokePlan {
  newRoles: RolesClaim;
  revokeRefreshTokens: true;
  fullRevoke: boolean;
}

/**
 * No `target` → full revoke (`newRoles: {}`, `fullRevoke: true`). A `target` → removes that
 * role from that show's array, pruning the show's key entirely if the array becomes empty
 * (keeps the ~1000-byte custom-claim budget, per spec §5.4, from accumulating empty entries).
 * `revokeRefreshTokens` is `true` unconditionally, on every branch, including a no-op target —
 * spec §5.5 treats a revoke as security-critical to apply immediately, independent of whether
 * anything in the claim actually changed.
 */
export function computeRevokePlan(
  existingRoles: RolesClaim | undefined,
  target?: RevokeTarget,
): RevokePlan {
  if (!target) {
    return { newRoles: {}, revokeRefreshTokens: true, fullRevoke: true };
  }

  const newRoles: RolesClaim = {};
  for (const [show, roleNames] of Object.entries(existingRoles ?? {})) {
    if (show !== target.show) {
      newRoles[show] = roleNames;
      continue;
    }
    const pruned = roleNames.filter((name) => name !== target.role);
    if (pruned.length > 0) {
      newRoles[show] = pruned;
    }
  }

  return { newRoles, revokeRefreshTokens: true, fullRevoke: false };
}
