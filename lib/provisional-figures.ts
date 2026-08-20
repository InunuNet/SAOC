/**
 * F4 (multi-line-item-cart, M2) — the SOLE source of truth for every admission-product
 * price/capacity/releasedQuantity/earlyBirdCutoff number. Every value below is transcribed
 * verbatim from `.agent/memory/project/provisional-figures.md` — do not re-type any of these
 * numbers anywhere else in the codebase (scripts/seed-ticketing.ts imports this array rather
 * than carrying its own copy). See
 * contracts/golden/ticketing-f4-admission-products/README.md for the full decision record,
 * including why a Child ticket is deliberately NOT included here.
 */

export interface ProvisionalAdmissionProduct {
  slug: string;
  name: string;
  price: number;
  /** Permanent, factual copy of what the ticket covers — never references pricing or
   *  confirmation status. Provisional-pricing messaging comes ONLY from the flag-gated
   *  badge (TicketTypeCard's `provisional` prop), never from this text. */
  description: string;
  capacity: number;
  releasedQuantity: number | null;
  /** ISO 8601 date, e.g. '2027-07-31'. null = no early-bird window (always on sale while
   *  general sales are open). */
  earlyBirdCutoff: string | null;
  requiresDaySelection: boolean;
  requiresAttendeeNames: boolean;
  /** Always `true` in this file today — literal, not computed — see golden README "The
   *  provisional flag is per-value, not per-file". */
  provisional: true;
}

export const EARLY_BIRD_CUTOFF = '2027-07-31';

export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'early-bird',
    name: 'Early-Bird Exhibition Ticket',
    description: 'Single-day admission to the National Show during the early-bird window.',
    price: 130,
    capacity: 400,
    releasedQuantity: 400,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'day-visitor',
    name: 'Day Visitor Ticket',
    description: 'Single-day general admission to the National Show — choose your day.',
    price: 150,
    capacity: 800,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: true,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'early-bird-weekend-pass',
    name: 'Early-Bird Weekend Pass',
    description: 'Full-weekend admission to the National Show during the early-bird window.',
    price: 380,
    capacity: 150,
    releasedQuantity: 150,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'weekend-pass',
    name: 'Weekend Pass',
    description: 'Full-weekend admission to the National Show.',
    price: 400,
    capacity: 300,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'vip',
    name: 'VIP Ticket',
    description: 'Reception access plus full-weekend admission to the National Show.',
    price: 300,
    capacity: 120,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
];
