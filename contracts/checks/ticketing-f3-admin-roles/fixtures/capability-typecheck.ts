// F3 (ticketing-foundation) — behavioural (compiler-driven, not source-grep) proof that
// `Capability` (exported from lib/admin-roles.ts) is EXACTLY the seven-member closed union
// spec §5.2 defines, no more and no fewer. Run via its own scoped tsconfig (see that file's
// header) because the root tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Technique: assign each of the seven real capability strings to `Capability`, then assign
// an eighth, deliberately typo'd string with `@ts-expect-error`. If `Capability` is ever
// loosened to `string`, or a capability is silently renamed/dropped, the compiler either
// stops rejecting the typo (an "Unused '@ts-expect-error' directive" error) or stops
// accepting one of the seven real ones — either way this file, and therefore A2, fails.
// This is a real compiler-driven proof, not a grep for capability names in the source file.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f3-admin-roles/tsconfig.typecheck.json
//
// DO NOT refactor the seven literal strings below to
// `import { CAPABILITIES } from '../../../../lib/admin-roles'` and spread/iterate them —
// that looks like a reasonable DRY cleanup but silently deletes this fixture's entire
// purpose. @qa proved live that A3, A5, and A6 all compare resolve()'s output against
// CAPABILITIES imported from lib/admin-roles.ts ITSELF — so a capability consistently
// renamed everywhere in that file (e.g. 'issue-comp' -> 'issue-comps', in both CAPABILITIES
// and every role bundle at once) is invisible to all three: both sides of every comparison
// shift together. This file is the ONLY check in the F3 contract with an independent,
// hard-coded opinion of what the seven capabilities are supposed to be — only that
// independence lets it catch a whole-set rename. Importing CAPABILITIES here would remove
// that independence and leave the contract with no check capable of catching that mutation
// at all. See golden/README.md, "Why capability-typecheck.ts's seven literals must stay
// hard-coded."

import type { Capability } from '../../../../lib/admin-roles';

const viewDashboard: Capability = 'view-admin-dashboard';
const scanCheckin: Capability = 'scan-checkin';
const lookupBookingRef: Capability = 'lookup-booking-ref';
const searchBuyers: Capability = 'search-buyers';
const issueComp: Capability = 'issue-comp';
const issueRefund: Capability = 'issue-refund';
const exportBuyerData: Capability = 'export-buyer-data';

// @ts-expect-error — 'export-buyers-data' (a plausible typo of the real
// 'export-buyer-data') has never been, and must never silently become, a member of
// Capability. Seven real values only — see spec §5.2's enumerated table.
const typo: Capability = 'export-buyers-data';

export {
  viewDashboard,
  scanCheckin,
  lookupBookingRef,
  searchBuyers,
  issueComp,
  issueRefund,
  exportBuyerData,
  typo,
};
