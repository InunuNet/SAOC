// F4 (ticketing-foundation) — compiler-driven (not source-grep) proof of the exported type
// shapes lib/admin-auth.ts and lib/admin-migrate-roles-plan.ts must add. Run via its own
// scoped tsconfig (see that file's header) because the root tsconfig.json excludes
// `contracts/` from `pnpm type-check`.
//
// Two things proven here that A3-A11's runtime calls cannot see:
//   1. RolesClaim / ShowWindow / ShowWindowLookup / hasCapability's signature are exactly the
//      shapes the golden README specifies — a real assignment either compiles or it doesn't.
//   2. The migration plan's 'grant' action variant has NO revokeRefreshTokens field, at the
//      type level. This is a genuine authorship/construction property, not merely a runtime
//      one: even if a future edit accidentally has computeMigrationPlan() attach
//      `revokeRefreshTokens: false` to a 'grant' action (which would satisfy A11's live checks,
//      since A11 only checks for the KEY's absence on the values it happens to receive), THIS
//      file still catches a 'grant' action type that was widened to include the field at all,
//      because @ts-expect-error demands the property access actually fail to compile.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f4-roles-claim/tsconfig.typecheck.json

import type { DecodedIdToken } from 'firebase-admin/auth';

import type { RolesClaim, ShowWindow, ShowWindowLookup } from '../../../../lib/admin-auth';
import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../../lib/admin-auth';
import type { Capability } from '../../../../lib/admin-roles';
import type { MigrationAction } from '../../../../lib/admin-migrate-roles-plan';

const roles: RolesClaim = { '*': ['owner'], nationalShow: ['manager'] };

const lookup: ShowWindowLookup = (showId: string): ShowWindow | null => {
  if (showId === 'nationalShow') {
    return { startDate: new Date('2027-01-01'), endDate: new Date('2027-01-10') };
  }
  return null;
};

const caps = resolveRoleCapabilitiesForShow(roles, 'nationalShow', {
  now: new Date(),
  lookupShowWindow: lookup,
});
const capCheck: Capability = [...caps][0] ?? 'scan-checkin';

// hasCapability accepts a real DecodedIdToken. No `any` and no `as unknown as` cast: every
// field DecodedIdToken actually REQUIRES (aud, auth_time, exp, firebase, iat, iss, sub, uid)
// is fabricated with an inert placeholder value below, and DecodedIdToken's own trailing
// `[key: string]: any` index signature is what makes the extra `admin`/`roles` custom-claim
// properties assignable without widening anything — a real structural fit, not a suppression.
// The property values under test (admin, email_verified, email, roles) are typed correctly
// and are exactly what A3's runtime check exercises.
function fakeDecodedIdToken(claims: {
  admin: boolean;
  email_verified: boolean;
  email: string;
  roles?: RolesClaim;
}): DecodedIdToken {
  return {
    aud: 'fake-project',
    auth_time: 0,
    exp: 0,
    firebase: { identities: {}, sign_in_provider: 'password' },
    iat: 0,
    iss: 'https://securetoken.google.com/fake-project',
    sub: 'fake-uid',
    uid: 'fake-uid',
    ...claims,
  };
}

const allowed: boolean = hasCapability(
  fakeDecodedIdToken({ admin: true, email_verified: true, email: 'test@example.com', roles }),
  'nationalShow',
  'scan-checkin',
  { now: new Date(), lookupShowWindow: lookup },
);

const grantAction: MigrationAction = { uid: 'abc', action: 'grant', newRoles: { '*': ['owner'] } };

// @ts-expect-error — the 'grant' action variant must never carry a revokeRefreshTokens field.
// The migration path is additive-only and must not be able to express a revoke instruction at
// the type level, matching "the migration path does NOT call revokeRefreshTokens()"
// (golden/README.md, migration decision 3). If this line stops erroring, the type has been
// widened to allow exactly the field that decision forbids.
const illegalRevokeField = grantAction.revokeRefreshTokens;

export { caps, capCheck, allowed, grantAction, illegalRevokeField };
