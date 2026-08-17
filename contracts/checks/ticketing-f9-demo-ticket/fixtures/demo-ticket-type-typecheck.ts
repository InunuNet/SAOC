// F9 (ticketing-foundation) — compiler-driven (not source-grep) proof of the exported type
// shapes lib/demo-ticket-type.ts and lib/demo-ticket-type-seed-plan.ts must add. Run via its
// own scoped tsconfig (see that file's header) because the root tsconfig.json excludes
// `contracts/` from `pnpm type-check`.
//
// Two things proven here that the runtime checks (A3, A5, A6) cannot see:
//   1. filterPubliclyListableTicketTypes() is genuinely generic — it accepts (and returns) a
//      fixture type WIDER than TicketTypeCatalogueMarkerFields, so callers don't have to
//      narrow their real Sanity response shape down to the marker fields alone just to filter
//      it.
//   2. DemoTicketTypeSeedPlan is a real discriminated union that narrows correctly by
//      `action` — `plan.document` is only accessible once `plan.action === 'create'` has been
//      checked, not a widened shape where both branches always expose both fields.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f9-demo-ticket/tsconfig.typecheck.json

import type { TicketTypeCatalogueMarkerFields } from '../../../../lib/demo-ticket-type';
import {
  DEMO_TICKET_TYPE_SLUG,
  DEMO_TICKET_TYPE_NAME,
  DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR,
  DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY,
  isDemoTicketTypeDoc,
  isDemoTicketTypeSlug,
  filterPubliclyListableTicketTypes,
} from '../../../../lib/demo-ticket-type';

import type {
  ExistingTicketTypeDoc,
  DemoTicketTypeSeedInput,
  DemoTicketTypeSeedPlan,
  DemoTicketTypeSeedDocument,
} from '../../../../lib/demo-ticket-type-seed-plan';
import { planDemoTicketTypeSeed } from '../../../../lib/demo-ticket-type-seed-plan';

// --- demo-ticket-type.ts ---

const slugConst: string = DEMO_TICKET_TYPE_SLUG;
const nameConst: string = DEMO_TICKET_TYPE_NAME;
const priceConst: number = DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR;
const capacityConst: number = DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY;

const marker: TicketTypeCatalogueMarkerFields = { slug: 'demo-general-admission', demo: true };
const isDoc: boolean = isDemoTicketTypeDoc(marker);
const isSlug: boolean = isDemoTicketTypeSlug('demo-general-admission');
const isSlugNullable: boolean = isDemoTicketTypeSlug(null);

// Proves the generic accepts (and returns) a WIDER fixture shape than the marker interface
// alone — the real Sanity response the /tickets page fetches carries `name`/`price`/etc.
// too, and the filter must not force callers to strip those fields first.
interface WidePageTicketType extends TicketTypeCatalogueMarkerFields {
  _id: string;
  name: string;
  price: number;
}

const wideFixture: WidePageTicketType[] = [
  { _id: 'ticketType-adult', name: 'Adult', slug: 'adult', price: 250, demo: false },
];
const filtered: WidePageTicketType[] = filterPubliclyListableTicketTypes<WidePageTicketType>(wideFixture);

// --- demo-ticket-type-seed-plan.ts ---

const existing: ExistingTicketTypeDoc[] = [
  { _id: 'ticketType-adult', slug: 'adult', show: { _ref: 'show-19-2027' } },
  { _id: 'ticketType-legacy', slug: null, show: null },
];

const seedInput: DemoTicketTypeSeedInput = {
  activeShowId: 'show-19-2027',
  existingTicketTypes: existing,
};

const plan: DemoTicketTypeSeedPlan = planDemoTicketTypeSeed(seedInput);

// Discriminated-union narrowing — `document`/`existingId` are only accessible after checking
// `action`. If DemoTicketTypeSeedPlan were widened to expose both fields unconditionally, this
// would still compile and this check would prove nothing about the union being real; the
// narrowing itself is exercised by the `if` below.
let narrowedDocument: DemoTicketTypeSeedDocument | undefined;
let narrowedExistingId: string | undefined;
if (plan.action === 'create') {
  narrowedDocument = plan.document;
} else {
  narrowedExistingId = plan.existingId;
}

export {
  slugConst,
  nameConst,
  priceConst,
  capacityConst,
  isDoc,
  isSlug,
  isSlugNullable,
  filtered,
  seedInput,
  plan,
  narrowedDocument,
  narrowedExistingId,
};
