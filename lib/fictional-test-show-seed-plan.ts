// Fictional Test Show — the pure, offline, idempotent seed decisions for the fictional show
// document and its scoped ticket type. Mirrors lib/demo-ticket-type-seed-plan.ts's shape
// exactly, kept as sibling modules with their own local types rather than importing/widening
// F9's — see contracts/golden/fictional-test-show/README.md "Why separate modules, not an
// edit to F9's files". No @sanity/client import, no I/O, no Date.now().

import {
  FICTIONAL_SHOW_ID,
  FICTIONAL_SHOW_SLUG,
  FICTIONAL_SHOW_TICKET_TYPE_CAPACITY,
  FICTIONAL_SHOW_TICKET_TYPE_ID,
  FICTIONAL_SHOW_TICKET_TYPE_NAME,
  FICTIONAL_SHOW_TICKET_TYPE_PRICE_ZAR,
  FICTIONAL_SHOW_TICKET_TYPE_SLUG,
  FICTIONAL_SHOW_TITLE,
} from './fictional-test-show';

export interface ExistingShowDoc {
  _id: string;
  slug: string | null;
}

export type FictionalShowSeedPlan =
  | {
      action: 'create';
      document: {
        _id: string;
        _type: 'show';
        title: string;
        slug: { _type: 'slug'; current: string };
        status: 'cancelled';
        active: false;
        fictionalTestData: true;
      };
    }
  | { action: 'skip-exists'; existingId: string };

/**
 * Plans the fictional show document's creation, or a skip if it already exists.
 * `document.active` is the TYPE LITERAL `false` — not a parameter, not derived from any
 * input — the load-bearing safety invariant: nothing this function is ever called with can
 * talk it into planning an active fictional show. `document.status` is the type literal
 * `'cancelled'` for the same reason, though it is not itself load-bearing (no query anywhere
 * selects on or excludes `status === 'cancelled'` — see golden README "Judgement call:
 * status: 'cancelled', not 'upcoming'").
 */
export function planFictionalTestShowDocument(existingShows: ExistingShowDoc[]): FictionalShowSeedPlan {
  const existing = existingShows.find((s) => s._id === FICTIONAL_SHOW_ID);
  if (existing) {
    return { action: 'skip-exists', existingId: existing._id };
  }

  return {
    action: 'create',
    document: {
      _id: FICTIONAL_SHOW_ID,
      _type: 'show',
      title: FICTIONAL_SHOW_TITLE,
      slug: { _type: 'slug', current: FICTIONAL_SHOW_SLUG },
      status: 'cancelled',
      active: false,
      fictionalTestData: true,
    },
  };
}

export interface ExistingTicketTypeDoc {
  _id: string;
  slug: string | null;
  show?: { _ref: string } | null;
}

export type FictionalShowTicketTypeSeedPlan =
  | {
      action: 'create';
      document: {
        _id: string;
        _type: 'ticketType';
        name: string;
        slug: { _type: 'slug'; current: string };
        price: number;
        capacity: number;
        active: true;
        order: 999;
        demo: true;
        show: { _type: 'reference'; _ref: string };
        description: string;
      };
    }
  | { action: 'skip-exists'; existingId: string };

// Display order among the real catalogue tiers is irrelevant — the fictional ticket type is
// never publicly listed (demo:true excludes it via lib/demo-ticket-type.ts's
// filterPubliclyListableTicketTypes()) — a high fixed value simply keeps it out of the way in
// Studio's own document list ordering. See golden README, "Judgement calls made", 4.
const SEED_ORDER = 999;

const SEED_DESCRIPTION =
  'Test data — never real pricing. Used to exercise the ticketing pipeline end-to-end in ' +
  'isolation from the real show. Never active except for a brief, human-supervised test window.';

/**
 * Deterministic, per-show idempotent seed decision for the fictional show's own ticket type.
 * `_id` is always FICTIONAL_SHOW_TICKET_TYPE_ID (fixed, no interpolation — see
 * lib/fictional-test-show.ts). Dedups on `slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG` AND
 * `show?._ref === FICTIONAL_SHOW_ID` together — per-show, not global, matching F9's own A5
 * case 3 reasoning — so an existing same-slug ticket type scoped to a DIFFERENT show never
 * blocks seeding the fictional show's own copy.
 */
export function planFictionalTestShowTicketTypeSeed(
  existingTicketTypes: ExistingTicketTypeDoc[]
): FictionalShowTicketTypeSeedPlan {
  const existing = existingTicketTypes.find(
    (t) => t.slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG && t.show?._ref === FICTIONAL_SHOW_ID
  );
  if (existing) {
    return { action: 'skip-exists', existingId: existing._id };
  }

  return {
    action: 'create',
    document: {
      _id: FICTIONAL_SHOW_TICKET_TYPE_ID,
      _type: 'ticketType',
      name: FICTIONAL_SHOW_TICKET_TYPE_NAME,
      slug: { _type: 'slug', current: FICTIONAL_SHOW_TICKET_TYPE_SLUG },
      price: FICTIONAL_SHOW_TICKET_TYPE_PRICE_ZAR,
      capacity: FICTIONAL_SHOW_TICKET_TYPE_CAPACITY,
      active: true,
      order: SEED_ORDER,
      demo: true,
      show: { _type: 'reference', _ref: FICTIONAL_SHOW_ID },
      description: SEED_DESCRIPTION,
    },
  };
}
