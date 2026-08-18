/**
 * Fixed capability set and role→capability mapping for the ticketing admin surface. See
 * contracts/golden/ticketing-f3-admin-roles/README.md for the decision record (spec §5.2-5.3).
 *
 * Pure, side-effect-free constant module — no cookies(), no Firestore, no Firebase Auth.
 * F4 is the only feature that wires this into a live request path (custom-claim resolution).
 */

export const CAPABILITIES = [
  'view-admin-dashboard',
  'scan-checkin',
  'lookup-booking-ref',
  'search-buyers',
  'issue-comp',
  'issue-refund',
  'export-buyer-data',
  'review-vendor-applications',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const ROLE_NAMES = ['door-staff', 'manager', 'owner'] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const ROLE_TO_CAPABILITIES: Record<RoleName, ReadonlySet<Capability>> = {
  'door-staff': new Set(['scan-checkin', 'lookup-booking-ref']),
  // HAND-LISTED, deliberately NOT `new Set(CAPABILITIES)` — manager is Lee-Ann's role and
  // already holds export-buyer-data, the most POPIA-sensitive capability in the set. A
  // derived manager would silently gain any capability added to CAPABILITIES in future, with
  // no code change to this line and nothing for a reviewer to see. manager is a config choice
  // about one person's job, not a structural guarantee like owner's — see README's
  // "Contradiction found and resolved" for why this exact mistake shipped once already.
  manager: new Set([
    'view-admin-dashboard',
    'scan-checkin',
    'lookup-booking-ref',
    'search-buyers',
    'issue-comp',
    'issue-refund',
    'export-buyer-data',
    'review-vendor-applications',
  ]),
  // Derived from CAPABILITIES, not hand-listed: owner is defined semantically as "every
  // currently-defined capability, full stop" (spec §5.3). A hand-typed literal here would go
  // stale silently the day a new capability is added elsewhere — see README's "Why owner
  // must be derived, not hand-listed."
  owner: new Set(CAPABILITIES),
};

/**
 * Unions the capability bundles of every given role name. Takes `readonly string[]`, not
 * `RoleName[]`: callers (F4's custom-claim resolution) pass whatever role-name strings are
 * actually stored in a Firebase custom claim — untrusted, mutable-by-a-future-editor data at
 * runtime, not a compile-time-checked literal. A name that isn't a recognised role
 * contributes nothing — fail-closed by construction (falls through the lookup miss below),
 * not by an explicit "is this a known role" branch.
 */
export function resolve(roleNames: readonly string[]): Set<Capability> {
  const result = new Set<Capability>();
  for (const name of roleNames) {
    const bundle = (ROLE_TO_CAPABILITIES as Record<string, ReadonlySet<Capability> | undefined>)[
      name
    ];
    if (!bundle) continue;
    for (const cap of bundle) result.add(cap);
  }
  return result;
}
