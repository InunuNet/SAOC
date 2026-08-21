/**
 * F4 (multi-line-item-cart, M2) — the SOLE source of truth for every admission-product
 * price/capacity/releasedQuantity/earlyBirdCutoff number. Every value below is transcribed
 * verbatim from `.agent/memory/project/provisional-figures.md` — do not re-type any of these
 * numbers anywhere else in the codebase (scripts/seed-ticketing.ts imports this array rather
 * than carrying its own copy). See
 * contracts/golden/ticketing-f4-admission-products/README.md for the full decision record,
 * including why a Child ticket is deliberately NOT included here.
 */

export type ProvisionalProductCategory = 'admission' | 'conference' | 'workshop-field-trip';

export interface ProvisionalAdmissionProduct {
  slug: string;
  name: string;
  /** F3 (ticketing-conferences-and-events, M2): which purchase page this product belongs
   *  on — admission (/tickets), conference (/national-show/conferences), or
   *  workshop-field-trip (/national-show/workshops). See
   *  contracts/golden/ticketing-purchase-pages-f3/README.md. */
  category: ProvisionalProductCategory;
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
    category: 'admission',
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
    category: 'admission',
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
    category: 'admission',
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
    category: 'admission',
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
    category: 'admission',
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

/**
 * F1 (ticketing-conferences-and-events, M1) — the six Conferences category products (SAOC
 * Symposium, WOSA Conference, SAOC/WOSA Joint, each Early-Bird/Normal). Reuses
 * `ProvisionalAdmissionProduct` verbatim rather than a second interface — see
 * contracts/golden/ticketing-conferences-f1/README.md for the full pricing/capacity
 * rationale (our estimate, no client source; Joint is priced as a genuine bundle discount).
 */

const SYMPOSIUM_CONFERENCE_EARLY_BIRD_PRICE = 450;
const SYMPOSIUM_CONFERENCE_NORMAL_PRICE = 550;
const JOINT_EARLY_BIRD_PRICE = 750;
const JOINT_NORMAL_PRICE = 900;

const SINGLE_TRACK_CAPACITY = 150;
const JOINT_CAPACITY = 80;

export const CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'saoc-symposium-early-bird',
    name: 'SAOC Symposium (Early-Bird)',
    category: 'conference',
    description: 'Full registration for the SAOC Symposium track during the early-bird window.',
    price: SYMPOSIUM_CONFERENCE_EARLY_BIRD_PRICE,
    capacity: SINGLE_TRACK_CAPACITY,
    releasedQuantity: SINGLE_TRACK_CAPACITY,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'saoc-symposium',
    name: 'SAOC Symposium',
    category: 'conference',
    description: 'Full registration for the SAOC Symposium track.',
    price: SYMPOSIUM_CONFERENCE_NORMAL_PRICE,
    capacity: SINGLE_TRACK_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'wosa-conference-early-bird',
    name: 'WOSA Conference (Early-Bird)',
    category: 'conference',
    description: 'Full registration for the WOSA Conference track during the early-bird window.',
    price: SYMPOSIUM_CONFERENCE_EARLY_BIRD_PRICE,
    capacity: SINGLE_TRACK_CAPACITY,
    releasedQuantity: SINGLE_TRACK_CAPACITY,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'wosa-conference',
    name: 'WOSA Conference',
    category: 'conference',
    description: 'Full registration for the WOSA Conference track.',
    price: SYMPOSIUM_CONFERENCE_NORMAL_PRICE,
    capacity: SINGLE_TRACK_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'saoc-wosa-joint-early-bird',
    name: 'SAOC/WOSA Joint (Early-Bird)',
    category: 'conference',
    description:
      'Combined registration for both the SAOC Symposium and WOSA Conference tracks during ' +
      'the early-bird window.',
    price: JOINT_EARLY_BIRD_PRICE,
    capacity: JOINT_CAPACITY,
    releasedQuantity: JOINT_CAPACITY,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'saoc-wosa-joint',
    name: 'SAOC/WOSA Joint',
    category: 'conference',
    description: 'Combined registration for both the SAOC Symposium and WOSA Conference tracks.',
    price: JOINT_NORMAL_PRICE,
    capacity: JOINT_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
];

/**
 * F2 (ticketing-conferences-and-events, M1) — the four priceable Workshops & Field Trips
 * category products (Sunset Cocktails Single/Couple, Field Trip Single/All-Outings). Reuses
 * `ProvisionalAdmissionProduct` verbatim — see
 * contracts/golden/ticketing-workshops-f2/README.md for the full pricing/capacity rationale
 * (our estimate, no client source; both bundle prices are genuine discounts).
 *
 * Workshops itself is deliberately NOT included here — see `WORKSHOP_PRICING_STRUCTURE` below.
 */

const SUNSET_COCKTAILS_SINGLE_PRICE = 250;
const SUNSET_COCKTAILS_COUPLE_PRICE = 450;
const FIELD_TRIP_SINGLE_PRICE = 300;
const FIELD_TRIP_ALL_OUTINGS_PRICE = 750;

const SUNSET_COCKTAILS_SINGLE_CAPACITY = 100;
const SUNSET_COCKTAILS_COUPLE_CAPACITY = 50;
const FIELD_TRIP_SINGLE_CAPACITY = 30;
const FIELD_TRIP_ALL_OUTINGS_CAPACITY = 30;

export const WORKSHOP_FIELD_TRIP_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'sunset-cocktails-single',
    name: 'Sunset Cocktails (Single)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception. 18+ event.',
    price: SUNSET_COCKTAILS_SINGLE_PRICE,
    capacity: SUNSET_COCKTAILS_SINGLE_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'sunset-cocktails-couple',
    name: 'Sunset Cocktails (Couple)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception for two guests. 18+ event.',
    price: SUNSET_COCKTAILS_COUPLE_PRICE,
    capacity: SUNSET_COCKTAILS_COUPLE_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'field-trip-single',
    name: 'Field Trip (Single Outing)',
    category: 'workshop-field-trip',
    description: 'Transport and entry for one guided field trip outing.',
    price: FIELD_TRIP_SINGLE_PRICE,
    capacity: FIELD_TRIP_SINGLE_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
  {
    slug: 'field-trip-all-outings',
    name: 'Field Trip (All-Outings Pass)',
    category: 'workshop-field-trip',
    description: 'Transport and entry for all guided field trip outings.',
    price: FIELD_TRIP_ALL_OUTINGS_PRICE,
    capacity: FIELD_TRIP_ALL_OUTINGS_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
];

/**
 * F2 (ticketing-conferences-and-events, M1) — the Workshops per-session pricing STRUCTURE.
 * Deliberately NOT a `ProvisionalAdmissionProduct` (no `slug`, no `capacity`): no real workshop
 * session (name, date, capacity) is council-confirmed yet, so no fabricated sellable ticketType
 * document is created for it. See contracts/golden/ticketing-workshops-f2/README.md "The crux
 * decision" for why Workshops is structured differently from Sunset Cocktails and Field Trips.
 */

const WORKSHOP_ESTIMATED_SESSION_PRICE = 120;

export const WORKSHOP_PRICING_STRUCTURE = {
  model: 'per-session',
  estimatedSessionPrice: WORKSHOP_ESTIMATED_SESSION_PRICE,
  note:
    'No real workshop session (name, date, capacity) is council-confirmed yet, so none is ' +
    'instantiated as a sellable ticketType here. This price is a starting anchor for a human ' +
    'to adjust per session once real sessions are defined — not a figure to transcribe ' +
    'verbatim into every future workshop regardless of its actual content.',
  provisional: true,
} as const;
