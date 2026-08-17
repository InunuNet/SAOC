// F9 (ticketing-foundation) — the pure, offline, idempotent seed decision for the demo ticket
// type. Mirrors F4's lib/admin-migrate-roles-plan.ts's parseMigrationArgs()/computeMigrationPlan()
// split: this module computes what scripts/seed-demo-ticket-type.ts WOULD write, given
// injected existing-document state, without ever touching a real Sanity client. No
// @sanity/client import, no I/O, no Date.now(). See
// contracts/golden/ticketing-f9-demo-ticket/README.md, "Judgement calls made", 5 and 6, for
// the per-show dedup and deterministic-_id reasoning.

import {
  DEMO_TICKET_TYPE_NAME,
  DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY,
  DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR,
  DEMO_TICKET_TYPE_SLUG,
} from './demo-ticket-type';

export interface ExistingTicketTypeDoc {
  _id: string;
  slug: string | null;
  show?: { _ref: string } | null;
}

export interface DemoTicketTypeSeedInput {
  activeShowId: string;
  existingTicketTypes: ExistingTicketTypeDoc[];
}

export interface DemoTicketTypeSeedDocument {
  _id: string;
  _type: 'ticketType';
  name: string;
  slug: { _type: 'slug'; current: string };
  price: number;
  capacity: number;
  active: boolean;
  order: number;
  demo: true;
  show: { _type: 'reference'; _ref: string };
  description: string;
}

export type DemoTicketTypeSeedPlan =
  | { action: 'create'; document: DemoTicketTypeSeedDocument }
  | { action: 'skip-exists'; existingId: string };

// Display order among the real catalogue tiers is irrelevant — the demo type is never
// publicly listed (see lib/demo-ticket-type.ts's filterPubliclyListableTicketTypes()) — a high
// fixed value simply keeps it out of the way in Studio's own document list ordering.
const SEED_ORDER = 999;

const SEED_DESCRIPTION =
  'Test data — never real pricing. Used for end-to-end sandbox purchase proofs only.';

/**
 * Deterministic per-show idempotent seed decision. Dedups on `slug === DEMO_TICKET_TYPE_SLUG`
 * AND `show?._ref === activeShowId` together — per-show, not global, uniqueness — so an
 * existing demo document for a DIFFERENT (e.g. archived) show never blocks seeding this show's
 * own copy. See golden README, "Judgement calls made", 5.
 */
export function planDemoTicketTypeSeed(input: DemoTicketTypeSeedInput): DemoTicketTypeSeedPlan {
  const existing = input.existingTicketTypes.find(
    (t) => t.slug === DEMO_TICKET_TYPE_SLUG && t.show?._ref === input.activeShowId
  );
  if (existing) {
    return { action: 'skip-exists', existingId: existing._id };
  }

  return {
    action: 'create',
    document: {
      _id: `ticketType-demo-${input.activeShowId}`,
      _type: 'ticketType',
      name: DEMO_TICKET_TYPE_NAME,
      slug: { _type: 'slug', current: DEMO_TICKET_TYPE_SLUG },
      price: DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR,
      capacity: DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY,
      active: true,
      order: SEED_ORDER,
      demo: true,
      show: { _type: 'reference', _ref: input.activeShowId },
      description: SEED_DESCRIPTION,
    },
  };
}
