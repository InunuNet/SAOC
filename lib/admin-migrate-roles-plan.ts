/**
 * F4 (ticketing-foundation) — the one-time migration plan that grants every existing
 * `admin: true` account a baseline `{'*': ['owner']}` `roles` claim. See
 * contracts/golden/ticketing-f4-roles-claim/README.md, "The four live-migration-safety
 * decisions," for the full reasoning. Pure, side-effect-free — no Admin SDK, no network;
 * `scripts/admin-migrate-roles.ts` wires this to the live Firebase Auth user pool.
 */

import type { RolesClaim } from './admin-auth';

const BASELINE_OWNER_ROLES: RolesClaim = { '*': ['owner'] };

const APPLY_FLAG = '--apply';

export interface MigrationAccount {
  uid: string;
  admin?: boolean;
  roles?: RolesClaim;
}

// The 'grant' variant deliberately carries no `revokeRefreshTokens` field, at the type level —
// the migration path is additive-only to the sole live admin account and must never be able to
// express a revoke instruction, matching the golden README's migration decision 3. See
// contracts/checks/ticketing-f4-roles-claim/fixtures/roles-claim-typecheck.ts for the
// compiler-driven proof of this exact property.
export type MigrationAction =
  | { uid: string; action: 'grant'; newRoles: RolesClaim }
  | { uid: string; action: 'skip'; reason: string };

function hasNonEmptyRolesClaim(roles: RolesClaim | undefined): boolean {
  return roles !== undefined && Object.keys(roles).length > 0;
}

/**
 * Grants `{'*': ['owner']}` only to `admin: true` accounts with no existing non-empty `roles`
 * claim (idempotent, never overwrites). Every other account — non-admin, already migrated, or
 * holding a different existing claim — is included in the output tagged `'skip'` with a reason,
 * for dry-run auditability (golden README, judgement call 2), rather than silently omitted.
 */
export function computeMigrationPlan(accounts: MigrationAccount[]): MigrationAction[] {
  return accounts.map((account): MigrationAction => {
    if (account.admin !== true) {
      return { uid: account.uid, action: 'skip', reason: 'account is not an admin (admin !== true)' };
    }

    if (hasNonEmptyRolesClaim(account.roles)) {
      return {
        uid: account.uid,
        action: 'skip',
        reason: 'account already holds a non-empty roles claim — never overwritten',
      };
    }

    return { uid: account.uid, action: 'grant', newRoles: BASELINE_OWNER_ROLES };
  });
}

/** `apply` is true only when `'--apply'` is literally present in `argv`; dry-run is the default. */
export function parseMigrationArgs(argv: string[]): { apply: boolean } {
  return { apply: argv.includes(APPLY_FLAG) };
}
