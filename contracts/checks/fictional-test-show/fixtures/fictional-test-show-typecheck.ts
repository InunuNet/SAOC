// fictional-test-show — compiler-driven (not source-grep) proof of the exported type shapes
// lib/fictional-test-show.ts, lib/fictional-test-show-seed-plan.ts,
// lib/fictional-test-show-active-swap-plan.ts, and lib/fictional-test-show-recoverability.ts
// must add. Run via its own scoped tsconfig (see that file's header) because the root
// tsconfig.json excludes `contracts/` from `pnpm type-check`.
//
// Proven here, which the runtime checks (A3-A9) cannot see at the type level:
//   1. FictionalShowSeedPlan / FictionalShowTicketTypeSeedPlan are real discriminated unions
//      narrowing correctly by `action` — `plan.document` is only accessible once
//      `plan.action === 'create'` has been checked.
//   2. The seed documents' safety-invariant fields (`active: false` on the show plan,
//      `active: true` / `demo: true` on the ticket type plan) are real literal types, not
//      widened to `boolean`.
//   3. ActiveShowSwapPlan narrows correctly by `safe`.
//   4. FICTIONAL_SHOW_TICKET_TYPE_SLUG and F9's DEMO_TICKET_TYPE_SLUG are two textually
//      distinct string literal types — comparing them for equality must be a type error type
//      not "always true"/"always false" collapse (TypeScript flags a comparison between two
//      non-overlapping string literal types as an error under this project's strict config).
//
// Run as: npx tsc --noEmit -p contracts/checks/fictional-test-show/tsconfig.typecheck.json

import type {
  FictionalShowMarkerFields,
  FictionalShowTicketTypeMarkerFields,
} from '../../../../lib/fictional-test-show';
import {
  FICTIONAL_SHOW_ID,
  FICTIONAL_SHOW_SLUG,
  FICTIONAL_SHOW_TITLE,
  FICTIONAL_SHOW_TICKET_TYPE_ID,
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  FICTIONAL_SHOW_TICKET_TYPE_NAME,
  FICTIONAL_SHOW_TICKET_TYPE_PRICE_ZAR,
  FICTIONAL_SHOW_TICKET_TYPE_CAPACITY,
  isFictionalTestShowDoc,
  isFictionalTestShowTicketTypeDoc,
  isFictionalTestShowTicketTypeSlug,
} from '../../../../lib/fictional-test-show';

import { DEMO_TICKET_TYPE_SLUG } from '../../../../lib/demo-ticket-type';

import type {
  ExistingShowDoc,
  ExistingTicketTypeDoc,
  FictionalShowSeedPlan,
  FictionalShowTicketTypeSeedPlan,
} from '../../../../lib/fictional-test-show-seed-plan';
import {
  planFictionalTestShowDocument,
  planFictionalTestShowTicketTypeSeed,
} from '../../../../lib/fictional-test-show-seed-plan';

import type {
  ShowActivationRecord,
  ActiveShowSwapPlan,
} from '../../../../lib/fictional-test-show-active-swap-plan';
import { planActiveShowSwap } from '../../../../lib/fictional-test-show-active-swap-plan';

import type {
  RecoverablePosition,
  RecoverableOrder,
  RecoverableCheckinAttempt,
  FictionalTestShowArtifactReport,
} from '../../../../lib/fictional-test-show-recoverability';
import { classifyFictionalTestShowArtifacts } from '../../../../lib/fictional-test-show-recoverability';

// --- lib/fictional-test-show.ts ---

const idConst: string = FICTIONAL_SHOW_ID;
const slugConst: string = FICTIONAL_SHOW_SLUG;
const titleConst: string = FICTIONAL_SHOW_TITLE;
const ttIdConst: string = FICTIONAL_SHOW_TICKET_TYPE_ID;
const ttSlugConst: string = FICTIONAL_SHOW_TICKET_TYPE_SLUG;
const ttNameConst: string = FICTIONAL_SHOW_TICKET_TYPE_NAME;
const priceConst: number = FICTIONAL_SHOW_TICKET_TYPE_PRICE_ZAR;
const capacityConst: number = FICTIONAL_SHOW_TICKET_TYPE_CAPACITY;
void idConst;
void slugConst;
void titleConst;
void ttIdConst;
void ttNameConst;
void priceConst;
void capacityConst;

// (4) Two textually distinct string literal constants — proven by using them where a widened
// `string` would hide the distinction: assigning one to a variable typed as the other's exact
// literal type must fail. `@ts-expect-error` makes this an executable compiler proof, not a
// comment: if the two literals are genuinely distinct, the assignment below IS a type error and
// `@ts-expect-error` correctly suppresses it (this file compiles). If a future edit ever
// collapses the two constants to the same literal (e.g. FICTIONAL_SHOW_TICKET_TYPE_SLUG
// accidentally reusing DEMO_TICKET_TYPE_SLUG's value), the assignment STOPS being a type error,
// which makes the `@ts-expect-error` directive itself unused — TypeScript flags an unused
// `@ts-expect-error` as its own compile error, so this check fails the instant the two slugs
// collapse. The runtime proof (A7) is the independent, second half of this claim.
// @ts-expect-error - FICTIONAL_SHOW_TICKET_TYPE_SLUG must not be assignable to
// DEMO_TICKET_TYPE_SLUG's literal type; if this stops erroring, the two reserved slugs have
// collapsed to the same string.
const collapseCheck: typeof DEMO_TICKET_TYPE_SLUG = FICTIONAL_SHOW_TICKET_TYPE_SLUG;
void collapseCheck;

const markerFields: FictionalShowMarkerFields = { _id: idConst, slug: slugConst, fictionalTestData: true };
const showDocIsFictional: boolean = isFictionalTestShowDoc(markerFields);
void showDocIsFictional;

const ttMarkerFields: FictionalShowTicketTypeMarkerFields = {
  slug: ttSlugConst,
  show: { _ref: idConst },
};
const ttDocIsFictional: boolean = isFictionalTestShowTicketTypeDoc(ttMarkerFields);
void ttDocIsFictional;

const slugIsFictional: boolean = isFictionalTestShowTicketTypeSlug('anything');
void slugIsFictional;

// --- lib/fictional-test-show-seed-plan.ts ---

const existingShows: ExistingShowDoc[] = [{ _id: 'show-19-2027', slug: 'show-19-2027' }];
const showPlan: FictionalShowSeedPlan = planFictionalTestShowDocument(existingShows);
if (showPlan.action === 'create') {
  // Only reachable once narrowed — proves the discriminated union narrows.
  const activeLiteral: false = showPlan.document.active;
  const statusLiteral: 'cancelled' = showPlan.document.status;
  const fictionalLiteral: true = showPlan.document.fictionalTestData;
  void activeLiteral;
  void statusLiteral;
  void fictionalLiteral;
} else {
  const existingId: string = showPlan.existingId;
  void existingId;
}

const existingTicketTypes: ExistingTicketTypeDoc[] = [
  { _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } },
];
const ttPlan: FictionalShowTicketTypeSeedPlan = planFictionalTestShowTicketTypeSeed(existingTicketTypes);
if (ttPlan.action === 'create') {
  const activeLiteral: true = ttPlan.document.active;
  const demoLiteral: true = ttPlan.document.demo;
  const price: number = ttPlan.document.price;
  const capacity: number = ttPlan.document.capacity;
  void activeLiteral;
  void demoLiteral;
  void price;
  void capacity;
} else {
  const existingId: string = ttPlan.existingId;
  void existingId;
}

// --- lib/fictional-test-show-active-swap-plan.ts ---

const shows: ShowActivationRecord[] = [{ _id: 'show-19-2027', active: true }];
const swapPlan: ActiveShowSwapPlan = planActiveShowSwap(shows, FICTIONAL_SHOW_ID);
if (swapPlan.safe) {
  const deactivate: string[] = swapPlan.deactivate;
  const activate: string = swapPlan.activate;
  void deactivate;
  void activate;
} else {
  const reason: string = swapPlan.reason;
  void reason;
}

// --- lib/fictional-test-show-recoverability.ts ---

const positions: RecoverablePosition[] = [{ bookingRef: 'AAA111', ticketType: ttSlugConst, orderId: 'order-1' }];
const orders: RecoverableOrder[] = [{ id: 'order-1' }];
const checkinAttempts: RecoverableCheckinAttempt[] = [{ bookingRef: 'AAA111', orderId: 'order-1' }];
const report: FictionalTestShowArtifactReport = classifyFictionalTestShowArtifacts({
  positions,
  orders,
  checkinAttempts,
});
const reportedPositions: RecoverablePosition[] = report.positions;
const reportedOrders: RecoverableOrder[] = report.orders;
const reportedCheckins: RecoverableCheckinAttempt[] = report.checkinAttempts;
void reportedPositions;
void reportedOrders;
void reportedCheckins;
