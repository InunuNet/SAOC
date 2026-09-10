/**
 * F4 (multi-line-item-cart, M2) — the SOLE source of truth for every admission-product
 * price/capacity/releasedQuantity/earlyBirdCutoff number. Every value below is transcribed
 * verbatim from `.agent/memory/project/provisional-figures.md` — do not re-type any of these
 * numbers anywhere else in the codebase (scripts/seed-ticketing.ts imports this array rather
 * than carrying its own copy). See
 * contracts/golden/ticketing-f4-admission-products/README.md for the full decision record,
 * including why a Child ticket is deliberately NOT included here.
 */

// F2 (ticketing-complete, M1) defect repair 2026-09-08: relative, not '@/'-aliased, for the
// same reason lib/admission-early-bird-pricing.ts states at its own import of
// './checkout-reservation' — this module's check scripts import it directly via tsx/esm,
// outside Next.js's module resolution, which is the only place the '@/*' alias is honoured.
// Pulls in no I/O: the engine is pure, and its own single import is type-only (erased).
import { deriveAdmissionEarlyBirdCutoffIso } from './admission-early-bird-pricing';

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
  /** Per-value, not per-file — see golden README "The provisional flag is per-value, not
   *  per-file": most values in this file are `true` (web-team estimate/capacity, not yet
   *  council-settled), but a specific value can flip to `false` once genuinely settled
   *  (F2, ticketing-complete M1, 2026-09-08: VIP's price is the first such case — Brad's
   *  direct ruling, cited via `sourceCitation`, not a council confirmation, but settled
   *  either way — see the VIP entry below). Widened from the literal `true` this file
   *  originally used for that reason; every OTHER value keeps `provisional: true` as before. */
  provisional: boolean;
  /** F1 (ticketing-flow-redesign, M1): optional. Price after `earlyBirdCutoff` passes.
   *  Unset = sale closes at cutoff (unchanged legacy behavior) — see
   *  contracts/golden/ticketing-flow-redesign-f1/README.md §2. */
  regularPrice?: number | null;
  /** F5 (ticketing-conferences-and-events, M2): the shared physical pool this product's sold
   *  units draw from. `null`/unset (the default for every Admission/Conference product) means
   *  the product is its own singleton pool — byte-identical to today's per-slug behavior. See
   *  goldens/f5-checkout.golden.md "Determination 2". */
  capacityPool?: string | null;
  /** F5: how many physical seats/heads one sold unit of this product consumes against its
   *  pool. Defaults to 1 when unset. */
  headcountPerUnit?: number;
  /** F2 (ticketing-complete, M1): `null`/unset = genuine web-team estimate with no client
   *  source. A non-null string is a short citation to the exact source document, e.g.
   *  "Lee-Ann's 13.1 Ticketing system details.docx, line 305-314". Distinct from
   *  `provisional` — `provisional` means "council hasn't formally confirmed final
   *  pricing yet"; `sourceCitation` means "this number itself is not fabricated". A
   *  product can carry a real, cited figure and still be provisional pending council
   *  sign-off — the two are not mutually exclusive. See
   *  .agent/memory/project/specs/ticketing-complete/goldens/f2-provisional-figures-decisions.json. */
  sourceCitation?: string | null;
}

export const EARLY_BIRD_CUTOFF = '2027-07-31';

// F2 (ticketing-complete, M1) defect repair 2026-09-08 (Codex GPT-5.5 finding, verified real):
// VIP must NOT share the legacy EARLY_BIRD_CUTOFF constant (2027-07-31) — that date has no
// relationship to this mission's confirmed 90-day-before-show rule. VIP's cutoff is being
// freshly WRITTEN under Brad's 2026-09-08 ruling (not a preserved legacy value), so it must
// carry the DERIVED cutoff, computed by the same engine — never a second hand-typed copy of
// '2027-06-18'. The literal show start below is the same confirmed instant used as ground
// truth by check-vip-computed-early-bird-price.mjs and by
// goldens/fixtures/f1-pricing-boundary-cases.json's showStartDateIso.
//
// The `.slice(0, 10)` yields the bare `YYYY-MM-DD` shape every sibling `earlyBirdCutoff` field
// already uses. The engine returns a full '+02:00' instant for its own SAST-aware comparator;
// isWithinEarlyBirdWindow(), which gates VIP's runtime price via resolveEffectivePrice(),
// expects the bare-date shape — so the slice is load-bearing, not cosmetic.
const CONFIRMED_SHOW_START_2027 = new Date('2027-09-16T07:00:00Z');
const VIP_EARLY_BIRD_CUTOFF = deriveAdmissionEarlyBirdCutoffIso(CONFIRMED_SHOW_START_2027).slice(0, 10);

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
    slug: 'weekend-pass',
    name: 'Weekend Pass',
    category: 'admission',
    description: 'Full-weekend admission to the National Show.',
    price: 380,
    regularPrice: 400,
    capacity: 300,
    releasedQuantity: null,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'vip',
    name: 'VIP Ticket',
    category: 'admission',
    description: 'Reception access plus full-weekend admission to the National Show.',
    // F2 (ticketing-complete, M1) — Brad's DIRECT RULING (2026-09-08, not a council
    // confirmation, but settled — see docs/ticketing-complete-f2-open-decisions.md §1 for
    // the incoherent-ladder history this resolves): VIP is R625, with the standard 20%
    // early-bird discount applying (625 * 0.8 = 500 exactly — see
    // contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs, which
    // exercises the REAL lib/admission-early-bird-pricing.ts engine against this exact
    // number rather than assuming the arithmetic). This resolves the prior incoherent
    // ladder (VIP was priced below both Weekend Pass SKUs despite including the full
    // weekend plus a reception) — R625 sits above the R400 Weekend Pass, and the
    // discounted R500 still sits above both Weekend Pass SKUs (R380/R400).
    price: 500,
    regularPrice: 625,
    earlyBirdCutoff: VIP_EARLY_BIRD_CUTOFF,
    capacity: 120,
    releasedQuantity: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    // Settled, not provisional-pending-council — mislabelling a decided figure as awaiting
    // council confirmation would be the same provenance-loss shape sourceCitation exists to
    // prevent, one layer up. Also drops the data-placeholder treatment on this card (F2's
    // TicketTypeCard change gates data-placeholder on `provisional`, so this alone removes
    // it — no separate component change needed).
    provisional: false,
    sourceCitation: "Brad's direct ruling, 2026-09-08: VIP Pass R625, 20% early-bird discount applies (R500 early-bird).",
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
 * F2 (ticketing-conferences-and-events, M1) — the priceable Workshops & Field Trips
 * category products (Sunset Cocktails Single/Couple, Field Trip). Reuses
 * `ProvisionalAdmissionProduct` verbatim — see
 * contracts/golden/ticketing-workshops-f2/README.md for the original pricing/capacity
 * rationale.
 *
 * F2 (ticketing-complete, M1) UPDATE (2026-09-08): Sunset Cocktails pricing and the
 * Field Trip product shape were both corrected against Lee-Ann's "13.1 Ticketing system
 * details.docx" — see
 * .agent/memory/project/specs/ticketing-complete/goldens/f2-provisional-figures-decisions.json
 * for the exact citation lines and docs/ticketing-complete-f2-open-decisions.md for why
 * these are listed as CHANGED figures, not silently applied to the live dataset (that step
 * is scripts/migrate-f2-ticket-taxonomy.ts's dry-run-only plan, executed only by Brad's own
 * --apply in the morning, F8).
 *   - Sunset Cocktails Single/Couple: prior figures (R250/R450) were a genuine web-team
 *     estimate with no client source (`sourceCitation: null`). Replaced with the real,
 *     cited figures below.
 *   - Field Trips: the prior invented Single(R300)/All-Outings(R750) bundle split had no
 *     client source either. The real model is simpler — a flat R200 per trip, up to 5 named
 *     trips (not yet defined by any source, so no trip names/dates are invented here) —
 *     replaced by a single flat-rate product.
 *
 * Workshops itself is deliberately NOT included here — see `WORKSHOP_PRICING_STRUCTURE` below.
 */

const SUNSET_COCKTAILS_CITATION = "Lee-Ann's 13.1 Ticketing system details.docx, line 305-314";
const SUNSET_COCKTAILS_SINGLE_PRICE = 800;
const SUNSET_COCKTAILS_COUPLE_PRICE = 1500;

const FIELD_TRIP_CITATION = "Lee-Ann's 13.1 Ticketing system details.docx, line 158-162";
const FIELD_TRIP_FLAT_PRICE = 200;

// F5 (ticketing-conferences-and-events, M2): real physical ceilings, restored from F2's
// interim conservative resize (100/50/30/30) now that planPooledCapacity() correctly pools
// capacity across the products sharing each physical venue/vehicle constraint — see
// goldens/f5-checkout.golden.md "Determination 2".
const SUNSET_COCKTAILS_POOL_CAPACITY = 200;
const FIELD_TRIP_POOL_CAPACITY = 60;

export const WORKSHOP_FIELD_TRIP_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'sunset-cocktails-single',
    name: 'Sunset Cocktails (Single)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception. 18+ event.',
    price: SUNSET_COCKTAILS_SINGLE_PRICE,
    capacity: SUNSET_COCKTAILS_POOL_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'sunset-cocktails',
    headcountPerUnit: 1,
    sourceCitation: SUNSET_COCKTAILS_CITATION,
  },
  {
    slug: 'sunset-cocktails-couple',
    name: 'Sunset Cocktails (Couple)',
    category: 'workshop-field-trip',
    description: 'Admission to the Sunset Cocktails evening reception for two guests. 18+ event.',
    price: SUNSET_COCKTAILS_COUPLE_PRICE,
    capacity: SUNSET_COCKTAILS_POOL_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'sunset-cocktails',
    headcountPerUnit: 2,
    sourceCitation: SUNSET_COCKTAILS_CITATION,
  },
  {
    slug: 'field-trip',
    name: 'Field Trip (per outing)',
    category: 'workshop-field-trip',
    description: 'Transport and entry for one guided field trip outing.',
    price: FIELD_TRIP_FLAT_PRICE,
    capacity: FIELD_TRIP_POOL_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
    capacityPool: 'field-trip',
    headcountPerUnit: 1,
    sourceCitation: FIELD_TRIP_CITATION,
  },
];

/**
 * F2 (ticketing-complete, M1): the two invented bundle-split Field Trip SKUs this
 * migration retires (`active: false`, never deleted/renamed — see
 * scripts/migrate-f2-ticket-taxonomy.ts). Kept here, not in the script, so the retirement
 * list has exactly one source of truth alongside the products it replaces.
 */
export const RETIRED_FIELD_TRIP_SLUGS = ['field-trip-single', 'field-trip-all-outings'] as const;

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

/**
 * F1 (refunds-cancellation-terms, M1) — the SOLE source of truth for every refund/
 * cancellation figure rendered on `/refunds` (day thresholds, refund percentages, the
 * organiser-cancellation percentage, and the conference transfer window). None of these
 * numbers come from any SAOC document — see
 * .agent/memory/project/specs/refunds-cancellation-terms/goldens/f1-refunds-policy.golden.md
 * §3 for the full rationale per figure. Do not re-type any of these numbers anywhere else
 * — the page imports this constant directly. Deliberately excludes vendor stand bookings,
 * which have their own council-written 90-day clause
 * (docs/vendor-gated-registration-flow.md:435,668) — never restated here.
 */

export interface RefundCancellationTier {
  /** Minimum days' notice before the event start date for this tier to apply.
   *  null on the "less than X days" tier. */
  minDaysNotice: number | null;
  /** Maximum days' notice (exclusive) — null = no upper bound. */
  maxDaysNotice: number | null;
  /** Percentage of the ticket price refunded under this tier. */
  refundPercent: number;
}

export const PROVISIONAL_REFUND_POLICY = {
  /** Applies to admission, conference, and workshop/field-trip ticket products only.
   *  Vendor stand bookings are explicitly out of scope. */
  appliesTo: ['admission', 'conference', 'workshop-field-trip'] as const,
  cancellationTiers: [
    { minDaysNotice: 30, maxDaysNotice: null, refundPercent: 90 },
    { minDaysNotice: 14, maxDaysNotice: 30, refundPercent: 50 },
    { minDaysNotice: null, maxDaysNotice: 14, refundPercent: 0 },
  ] as RefundCancellationTier[],
  /** Full refund when SAOC cancels the event/activity outright. */
  organiserCancellationRefundPercent: 100,
  /** Conference (named-registrant) products only: free transfer to another named
   *  attendee up to this many days before the event, as an alternative to cancelling. */
  conferenceTransferWindowDays: 7,
  /** Always `true` in this file today — literal, not computed. Same convention as
   *  `ProvisionalAdmissionProduct.provisional`. */
  provisional: true as const,
} as const;
