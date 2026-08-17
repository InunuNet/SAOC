/**
 * F4 (ticketing-foundation) — validation for `scripts/admin-grant.ts`'s role-scoped grant
 * arguments. See contracts/golden/ticketing-f4-roles-claim/README.md for the decision record
 * (spec §5.6). Pure, side-effect-free — no Admin SDK, no network.
 */

import { ROLE_NAMES, type RoleName } from './admin-roles';

/** Role names that may only be granted scoped to a specific show, never org-wide (`'*'`). */
const SHOW_SCOPED_ONLY_ROLES: readonly RoleName[] = ['door-staff', 'manager'];

const ORG_WIDE_SCOPE = '*';

export interface GrantArgs {
  roles: string[];
  show: string;
}

export type GrantValidationResult = { ok: true } | { ok: false; reason: string };

function isRecognisedRoleName(name: string): name is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(name);
}

/**
 * Refuses empty `roles`, empty `show` (no defaults for either — spec §5.6), any role name not
 * in `ROLE_NAMES`, and any request where `show === '*'` and `roles` includes `door-staff` or
 * `manager` — refused as a whole when any one role in the batch is scope-restricted, so a
 * mixed list doesn't silently grant the restricted role org-wide alongside a permitted one.
 */
export function validateGrantArgs(args: GrantArgs): GrantValidationResult {
  if (args.roles.length === 0) {
    return { ok: false, reason: 'No role names given — a grant must name at least one role.' };
  }

  if (args.show.length === 0) {
    return { ok: false, reason: 'No show given — a grant must state exactly which scope it applies to.' };
  }

  const unrecognised = args.roles.filter((name) => !isRecognisedRoleName(name));
  if (unrecognised.length > 0) {
    return {
      ok: false,
      reason: `Unrecognised role name(s): ${unrecognised.join(', ')}. Recognised roles: ${ROLE_NAMES.join(', ')}.`,
    };
  }

  if (args.show === ORG_WIDE_SCOPE) {
    const restricted = args.roles.filter((name) =>
      SHOW_SCOPED_ONLY_ROLES.includes(name as RoleName),
    );
    if (restricted.length > 0) {
      return {
        ok: false,
        reason: `${restricted.join(', ')} may only be granted scoped to a specific show, never '*'.`,
      };
    }
  }

  return { ok: true };
}
