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
  /** F2 (conference-workshop-tickets, M1): ISO 8601 dates this product does NOT sell for,
   *  e.g. '2027-09-23'. `null`/unset (the default for every existing product) means no
   *  exclusion — zero behaviour change for any product that doesn't opt in. Additive to
   *  `requiresDaySelection`, not a replacement for it: a product can require a day pick AND
   *  exclude specific days from that pick (day-visitor and its early-bird sibling both do,
   *  per Brad's 2026-10-07 ticket news: "No Daypass on thursday"). See
   *  .agent/memory/project/specs/conference-workshop-tickets/goldens/f2-admission-evening-figures.golden.json. */
  excludedDays?: string[] | null;
}

export const EARLY_BIRD_CUTOFF = '2027-07-31';

// F2 (conference-workshop-tickets, M1) — Brad's ticket news, 2026-10-07 (verbatim), message
// 6: "500 early bird day v[i]stor tickets, 3 day booking and 1 day book[ing] all count to
// 500" and "Earlybird now ends after 500 tickets are sold not at a specific date". ONE shared
// pool, counted by units sold across BOTH the weekend-pass-early-bird and early-bird (day
// visitor's own EB) slugs below — not a per-product tranche, and no date cutoff at all. The
// single source both pool-sibling `capacity` fields reference, so the two 500s can never
// independently drift apart.
export const ADMISSION_EARLY_BIRD_POOL_CAPACITY = 500;

// Exported (not a bare module-local const) so contract check scripts can assert against the
// real pool-key literal instead of re-typing a second copy of 'admission-early-bird' — see
// contracts/checks/ticketing-conferences-and-events-f5/check-pool-data-invariant.mjs's scope
// guard, narrowed 2026-10-07 to read this constant directly.
export const ADMISSION_EARLY_BIRD_POOL_KEY = 'admission-early-bird';

// Brad's ticket news, 2026-10-07 (verbatim): "No Daypass on thursday it VIP meet ht e
// botoniosts and seperate cocktails tickets afterwards" — 2027-09-23 is the confirmed
// Thursday of the 23-26 Sept 2027 show window (project memory
// project_show_dates_placeholder.md). Shared by day-visitor and its early-bird sibling below
// — one literal, not two independently hand-typed copies.
const DAY_VISITOR_EXCLUDED_DAYS = ['2027-09-23'];

const DAY_VISITOR_SOURCE_CITATION =
  "Lee-Ann's sheet (relayed by Brad, 2026-10-07), line 23: '1 day Pass any day...(R150) " +
  "Early Bird(R120 only 500 available) 1000 Total per day'; Brad's ticket news, 2026-10-07 " +
  "(verbatim), message 6: '500 early bird day v[i]stor tickets, 3 day booking and 1 day " +
  "book[ing] all count to 500', 'No Daypass on thursday', and 'Earlybird now ends after 500 " +
  'tickets are sold not at a specific date\'. See .agent/memory/scratch/leeann-notes-2026-10-07.md ' +
  'and .agent/memory/scratch/brad-ticket-news-2026-10-07.md.';

// F2 (conference-workshop-tickets, M1) — Brad's ticket news, 2026-10-07 (verbatim), message
// 6 supersedes VIP's prior 2026-09-08 direct ruling (R625 regular / R500 computed early-bird,
// 120 capacity) — see the VIP entry's `sourceCitation` below for the explicit override
// citation. VIP no longer carries any early-bird mechanism, so the engine-derived cutoff this
// block used to compute (`VIP_EARLY_BIRD_CUTOFF`, `CONFIRMED_SHOW_START_2027`) is dead code
// now; removed along with the now-unused `deriveAdmissionEarlyBirdCutoffIso` import.
export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'early-bird',
    name: 'Day Visitor (Early Bird)',
    // Slug/_id preserved for continuity with any already-issued order — this is the Day
    // Visitor's own early-bird tier, re-shaped in place to the new pool-based mechanism
    // (not a new slug, unlike weekend-pass-early-bird below).
    category: 'admission',
    description: 'Single-day general admission to the National Show during the early-bird window — choose your day.',
    price: 120,
    capacity: ADMISSION_EARLY_BIRD_POOL_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    capacityPool: ADMISSION_EARLY_BIRD_POOL_KEY,
    headcountPerUnit: 1,
    requiresDaySelection: true,
    excludedDays: DAY_VISITOR_EXCLUDED_DAYS,
    requiresAttendeeNames: false,
    provisional: true,
    sourceCitation: DAY_VISITOR_SOURCE_CITATION,
  },
  {
    slug: 'day-visitor',
    name: 'Day Visitor Ticket',
    category: 'admission',
    description: 'Single-day general admission to the National Show — choose your day.',
    price: 150,
    capacity: 1000,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: true,
    excludedDays: DAY_VISITOR_EXCLUDED_DAYS,
    requiresAttendeeNames: false,
    provisional: true,
    sourceCitation: DAY_VISITOR_SOURCE_CITATION,
  },
  {
    slug: 'weekend-pass',
    name: 'Weekend Pass',
    category: 'admission',
    description: 'Full-weekend admission to the National Show.',
    price: 380,
    regularPrice: null,
    // Carried over unchanged from before the early-bird split — FLAGGED OPEN QUESTION, not
    // assumed: before the split this capped BOTH price tiers combined on one SKU; Brad's
    // message 6 does not say whether 300 still caps this regular-price product alone,
    // independent of weekend-pass-early-bird's own 500-ticket pool. See needs-Brad.
    capacity: 300,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    capacityPool: null,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
    sourceCitation:
      "Lee-Ann's sheet (relayed by Brad, 2026-10-07), line 22: '24-26 3 Day Weekend " +
      "pass(R380) Early Bird(R360) 9h00 -17h00, except Sunday 9h00-15h00'; Brad's ticket " +
      "news, 2026-10-07 (verbatim), message 6 moves the R360 early-bird price to the new " +
      "weekend-pass-early-bird product and removes the date-cutoff mechanism from this slug " +
      'entirely. Capacity (300) is carried over unchanged — not re-confirmed against the ' +
      'split; see the capacity comment above. See .agent/memory/scratch/leeann-notes-2026-10-07.md ' +
      'and .agent/memory/scratch/brad-ticket-news-2026-10-07.md.',
  },
  {
    // F2 (conference-workshop-tickets, M1) — genuinely NEW product/SKU, not a renamed or
    // recreated one. Required because a single SKU's own two-price-by-date shape cannot
    // express "shared pool with a DIFFERENT product's sold count" — see
    // goldens/f2-admission-evening-figures.golden.json "architectureChange_weekendPassSplit".
    slug: 'weekend-pass-early-bird',
    name: 'Weekend Pass (Early Bird)',
    category: 'admission',
    description: 'Full-weekend admission to the National Show at the early-bird price.',
    price: 360,
    regularPrice: null,
    // Declares the FULL shared-pool ceiling, same convention as every other pool sibling in
    // this file (sunset-cocktails-single/couple) — not a sub-allocation of the 500 for this
    // slug alone. Shares `ADMISSION_EARLY_BIRD_POOL_KEY` with the 'early-bird' slug above —
    // combined sold+reserved units across BOTH count against the one ceiling.
    capacity: ADMISSION_EARLY_BIRD_POOL_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    capacityPool: ADMISSION_EARLY_BIRD_POOL_KEY,
    headcountPerUnit: 1,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
    sourceCitation:
      "Lee-Ann's sheet (relayed by Brad, 2026-10-07), line 22 (R360 price); Brad's ticket " +
      "news, 2026-10-07 (verbatim), message 6: '500 early bird day v[i]stor tickets, 3 day " +
      "booking and 1 day book[ing] all count to 500' and 'Earlybird now ends after 500 " +
      'tickets are sold not at a specific date\'. See .agent/memory/scratch/leeann-notes-2026-10-07.md ' +
      'and .agent/memory/scratch/brad-ticket-news-2026-10-07.md.',
  },
  {
    slug: 'vip',
    name: 'VIP Ticket',
    category: 'admission',
    description: 'Reception access plus full-weekend admission to the National Show.',
    price: 300,
    regularPrice: null,
    earlyBirdCutoff: null,
    capacity: 200,
    releasedQuantity: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    // Still carried as `provisional: true` — this is team-lead's working DEFAULT (2026-10-07,
    // second pass), not a council-confirmed figure: the override itself remains on the
    // needs-Brad list, shipped as the default rather than blocked on it.
    provisional: true,
    sourceCitation:
      "OVERRIDE of Brad's direct ruling, 2026-09-08 (VIP Pass R625, 20% early-bird discount, " +
      "R500 early-bird, 120 capacity) — superseded by Lee-Ann's sheet (relayed by Brad, " +
      "2026-10-07), line 19: '23 VIP Thursday, Opening 3 Hours on thursday evening.(R300) " +
      "16h00-19h00 Total # 200 total'. Team-lead's second-pass default (2026-10-07): " +
      'implemented as the working figure; the override itself is not yet separately ' +
      're-confirmed by Brad and remains on the needs-Brad list. See ' +
      '.agent/memory/scratch/leeann-notes-2026-10-07.md.',
  },
];

/**
 * F1 (conference-workshop-tickets, M1) — the two Conferences category products (SAOC
 * Symposium, WOSA Conference). Reuses `ProvisionalAdmissionProduct` verbatim rather than a
 * second interface. UPDATED IN PLACE (same slug, same document identity) from the earlier
 * ticketing-conferences-and-events (M1/F1) six-SKU differential-early-bird-price/joint-bundle
 * design, per Brad's verbatim 2026-10-07 ticket news (messages 1, 3 and 6, see
 * .agent/memory/scratch/brad-ticket-news-2026-10-07.md): message 3 confirms SAOC Symposium
 * and WOSA Conference are separate products, each R2000 flat, 80 places; message 6 directly
 * supersedes message 4's same-day 10-ticket scarcity-tranche idea — "No early bird for
 * Symposiums and conferences" — so neither product carries ANY early-bird mechanism (no
 * cutoff, no second price, no reduced-capacity tranche field of any kind).
 *
 * The four retired differential-price/joint-bundle SKUs this replaces are named in
 * `RETIRED_CONFERENCE_SLUGS` below — never deleted (their Sanity documents are flipped
 * `active: false` by a migration script, same convention as `RETIRED_FIELD_TRIP_SLUGS`), but
 * no longer present in this live array.
 */

const SYMPOSIUM_WOSA_PRICE = 2000;
const SYMPOSIUM_WOSA_CAPACITY = 80;

const SYMPOSIUM_WOSA_SOURCE_CITATION =
  "Brad's ticket news, 2026-10-07 (verbatim), messages 1/3/6 — R2000 each, 80 tickets, " +
  "separate products ('Each cost R2000 symposium and Confernec' -> separate products), no " +
  "early-bird mechanism of any kind (message 6 directly answers and supersedes message 4's " +
  "earlier same-day scarcity-tranche design: 'No early bird for Symposiums and confernec'). " +
  'See .agent/memory/scratch/brad-ticket-news-2026-10-07.md.';

export const CONFERENCE_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'saoc-symposium',
    name: 'SAOC Symposium',
    category: 'conference',
    description: 'Full registration for the SAOC Symposium track.',
    price: SYMPOSIUM_WOSA_PRICE,
    capacity: SYMPOSIUM_WOSA_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    // Settled, not a web-team estimate — Brad's direct, unambiguous ruling (messages 1/3/6),
    // same "genuinely settled by a direct ruling, cited via sourceCitation, not a council
    // confirmation" precedent the ProvisionalAdmissionProduct.provisional doc-comment above
    // names (originally established for VIP's price, F2/ticketing-complete M1, 2026-09-08).
    provisional: false,
    sourceCitation: SYMPOSIUM_WOSA_SOURCE_CITATION,
  },
  {
    slug: 'wosa-conference',
    name: 'WOSA Conference',
    category: 'conference',
    description: 'Full registration for the WOSA Conference track.',
    price: SYMPOSIUM_WOSA_PRICE,
    capacity: SYMPOSIUM_WOSA_CAPACITY,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    // Settled, not a web-team estimate — Brad's direct, unambiguous ruling (messages 1/3/6),
    // same "genuinely settled by a direct ruling, cited via sourceCitation, not a council
    // confirmation" precedent the ProvisionalAdmissionProduct.provisional doc-comment above
    // names (originally established for VIP's price, F2/ticketing-complete M1, 2026-09-08).
    provisional: false,
    sourceCitation: SYMPOSIUM_WOSA_SOURCE_CITATION,
  },
];

/**
 * F1 (conference-workshop-tickets, M1) — the four retired Conferences SKUs: the old
 * differential early-bird/normal price pair for each of SAOC Symposium and WOSA Conference,
 * plus the SAOC/WOSA joint bundle's own early-bird/normal pair. Retired for two independent
 * reasons that both landed the same day — the joint bundle and the differential price were
 * already gone per messages 3-4, and message 6 additionally forecloses re-deriving any
 * differential price from them. Never deleted — a migration script sets `active: false` on
 * the existing Sanity documents, same convention as `RETIRED_FIELD_TRIP_SLUGS`.
 */
export const RETIRED_CONFERENCE_SLUGS = [
  'saoc-symposium-early-bird',
  'wosa-conference-early-bird',
  'saoc-wosa-joint-early-bird',
  'saoc-wosa-joint',
] as const;

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
 * F2 (conference-workshop-tickets, M1) — the Sunset Cocktails (Couple) SKU, retired
 * (`active: false`, never deleted/renamed — see F3's migration script), same convention as
 * `RETIRED_CONFERENCE_SLUGS`/`RETIRED_FIELD_TRIP_SLUGS`. Team-lead's second-pass default
 * (2026-10-07): whether this tier should exist at all remains an open needs-Brad item —
 * `active: false` is a working default, not a resolution. The product definition itself
 * stays in `WORKSHOP_FIELD_TRIP_PRODUCTS` above (byte-identical, figures untouched) for any
 * already-issued order's continuity; only the live Sanity document's `active` flag flips.
 * Kept here, not in the migration script, so the retirement list has exactly one source of
 * truth alongside the product it names.
 */
export const RETIRED_SUNSET_COCKTAILS_SLUGS = ['sunset-cocktails-couple'] as const;

/**
 * F2 (ticketing-conferences-and-events, M1) — the Workshops per-session pricing STRUCTURE.
 * Deliberately NOT a `ProvisionalAdmissionProduct` (no `slug`, no `capacity`): no real workshop
 * session (name, date, capacity) is council-confirmed yet, so no fabricated sellable ticketType
 * document is created for it. See contracts/golden/ticketing-workshops-f2/README.md "The crux
 * decision" for why Workshops is structured differently from Sunset Cocktails and Field Trips.
 *
 * F1 (conference-workshop-tickets, M1) UPDATE (2026-10-07): the old 120-estimate (web-team
 * guess, no client source) is superseded by Brad's real, direct, unambiguous figures —
 * verbatim message 2: "Workshops R100 each. Total 10 Tickets per session full workshop
 * schedule to follow." No early-bird concept for workshops appears in any of Brad's six
 * messages. `WORKSHOP_SESSION_PRICE`/`WORKSHOP_SESSION_CAPACITY` are exported as their own
 * named constants (not just inlined into the structure object below) so a future per-session
 * ticketType seeder can import the real figures directly. Still structure-only: zero
 * workshopSession/ticketType documents are seeded for any specific session, because the full
 * schedule has not been supplied.
 */

const WORKSHOP_SESSION_SOURCE_CITATION =
  "Brad's ticket news, 2026-10-07 (verbatim), message 2: 'Workshops R100 each. Total 10 " +
  "Tickets per session full workshop schedule to follow.' See " +
  '.agent/memory/scratch/brad-ticket-news-2026-10-07.md.';

export const WORKSHOP_SESSION_PRICE = 100;
export const WORKSHOP_SESSION_CAPACITY = 10;

export const WORKSHOP_PRICING_STRUCTURE = {
  model: 'per-session',
  estimatedSessionPrice: WORKSHOP_SESSION_PRICE,
  note:
    'No real workshop session (name, date, capacity) is council-confirmed yet, so none is ' +
    'instantiated as a sellable ticketType here. The price/capacity figures themselves are ' +
    "real and settled (Brad's direct 2026-10-07 ruling, not an estimate) — this object " +
    'remains a starting structure for a human to instantiate per session once real sessions ' +
    'are defined, not a figure to transcribe verbatim into every future workshop regardless ' +
    'of its actual content.',
  provisional: false,
  sourceCitation: WORKSHOP_SESSION_SOURCE_CITATION,
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
