import type { Timestamp } from 'firebase-admin/firestore';
import type { PortableTextBlock } from '@portabletext/react';
import type { SanityImageSource } from '@sanity/image-url';

export type Society = {
  name: string;
  region: string;
  province: string;
  founded: number;
  meet: string;
  venue: string;
  members?: number;
  city?: string;
  slug?: string;
  email?: string;
  chairName?: string;
  websiteUrl?: string;
};

export type SocietyEvent = {
  id: number;
  date: string;
  endDate?: string;
  title: string;
  host: string;
  venue: string;
  kind: string;
  province: string;
  description?: string;
};

export type NationalShow = {
  edition: number;
  year: number;
  month: string;
  host: string;
  venue: string;
  status: 'upcoming' | 'past';
  days?: number;
  entries?: number;
  /** Exhibitor count — Sanity's `show.exhibitors`. Distinct from `visitors`. */
  exhibitors?: number;
  visitors?: number;
  trophies?: number;
  heroImage?: string;
  grandChampion?: ShowWinner;
  reserveChampion?: ShowWinner;
  categoryWinners?: ShowWinner[];
  note?: string;
};

export type ShowWinner = {
  category: string;
  plantName: string;
  ownerName: string;
  imageUrl?: string;
};

export type Award = {
  code: string;
  name: string;
  threshold: string;
  description: string;
};

export type BoardMember = {
  name: string;
  role: string;
  society: string;
  tenure: string;
};

export type HeroImage = {
  name: string;
  path: string;
  alt: string;
};

export type Partner = {
  name: string;
  url?: string;
  logoUrl?: string;
};

export type Province = {
  code: string;
  name: string;
  /** Curated chip position on /societies. Lower sorts first. */
  order?: number;
};

export type ShowClass = {
  id: string;
  code: string;
  name: string;
  group: string;
  description: string;
};

export type SanityEvent = {
  _id: string;
  title: string;
  slug: string;
  date: string;
  endDate?: string | null;
  kind?: string | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
  isFeatured?: boolean | null;
  hostSociety?: {
    _id: string;
    name: string;
    slug: string;
  } | null;
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  status: 'new' | 'read' | 'replied';
};

export type TicketStatus = 'reserved' | 'paid' | 'cancelled' | 'checked-in' | 'refunded';

// Ticket types are no longer a hardcoded union — the council's real categories
// (adult, pensioner, child, SAOC member, exhibitor) live as `ticketType` Sanity
// documents, keyed by slug. This is a `string` on purpose: hardcoding a parallel
// TS union here would drift the moment someone adds/renames a category in Studio.
// Pre-reconciliation Firestore tickets ('general' | 'member' | 'vip') remain valid
// Ticket records under this looser type — they are simply orphaned from the current
// active ticketType catalogue, not migrated.
export type TicketType = string;

export interface Ticket {
  id: string;
  bookingRef: string;
  showId: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: TicketType;
  status: TicketStatus;
  amount: number;
  purchasedAt: Timestamp | null;
  checkedInAt: Timestamp | null;
  m_payment_id: string | null;
  pf_payment_id: string | null;
  // F2 (ticketing-foundation) — nullable because the pre-F2 legacy positions predate this
  // field and F2 ships no backfill/migration; null is the honest value for "no parent
  // order". See contracts/golden/ticketing-f2-orders-model/README.md "Field-move
  // decision, revised" for why this is additive, not a replacement of the four payment
  // fields above.
  orderId: string | null;
  // F8 (ticketing-foundation) — the issuing staff member's email for a comp position, null
  // for every paid position. Optional and nullable: pre-F8 Ticket literals never mention it
  // and must still compile. See contracts/golden/ticketing-f8-comp-tickets/README.md.
  compedBy?: string | null;
}

// F2 (ticketing-foundation) — an order is never itself "checked-in" (only a position is
// scanned at the door) or "refunded" (§4.3: a refund targets one position, never the
// whole order). Deliberately its own 3-member union, not TicketStatus — see
// contracts/golden/ticketing-f2-orders-model/README.md.
export type OrderStatus = 'reserved' | 'paid' | 'cancelled';

// F2 (ticketing-foundation) — sits between `show` and `tickets` (positions); §4.2/§4.4.
// `m_payment_id`/`pf_payment_id`/`gateway`/`gatewayPaymentId` are order-level payment
// concepts: once group orders exist (deferred, §9) an order can have several positions
// but only one PayFast payment. See golden/README.md "Order (new type)" for the full
// field-by-field rationale, including why `m_payment_id` is included despite being
// omitted from the mission-brief dispatch's field list.
export interface Order {
  id: string;
  showId: string;
  buyerName: string;
  buyerEmail: string;
  amount: number;
  status: OrderStatus;
  expiresAt: Timestamp | null;
  idempotencyKey: string;
  purchasedAt: Timestamp | null;
  gateway: string | null;
  gatewayPaymentId: string | null;
  m_payment_id: string | null;
  pf_payment_id: string | null;
  buyerUid?: string | null;
  /** F10 (ticketing-foundation) — optional/nullable, read defensively. Not yet generated at
   *  checkout time (checkout is outside F10's authorised scope); see
   *  contracts/golden/ticketing-f10-itn-repin/README.md "Judgement calls". */
  recoveryToken?: string | null;
  recoveryTokenExpiresAt?: Timestamp | null;
}

// ---------------------------------------------------------------------------
// F1 (show-visitor-info) — National Show visitor information.
// Mirrors the Sanity shapes in sanity/schemas/documents/showVisitorInfo.ts and
// sanity/schemas/objects/*. Every field is nullable because Sanity content is
// editor-controlled: a page must render sensibly against a half-filled document.
// ---------------------------------------------------------------------------

export type ConfirmationStatus = 'pending' | 'research' | 'confirmed';

export type ConfirmationBlock =
  | 'venue'
  | 'dates'
  | 'openingHours'
  | 'admission'
  | 'parking'
  | 'publicTransport'
  | 'accessibility'
  | 'photography'
  | 'cloakroom'
  | 'food'
  | 'accommodation'
  | 'attractions'
  | 'emergencyContacts';

export type ConfirmationStatuses = Partial<Record<ConfirmationBlock, ConfirmationStatus>>;

export type ShowVenue = {
  name?: string | null;
  addressLines?: string[] | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  mapsUrl?: string | null;
  mapImage?: SanityImageSource | null;
  mapImageAlt?: string | null;
  directionsNote?: string | null;
  phone?: string | null;
};

export type TravelRoute = {
  _key?: string;
  origin?: string | null;
  distance?: string | null;
  duration?: string | null;
  directions?: string | null;
  transportOptions?: string[] | null;
};

export type AccommodationDistanceBand = 'walking' | 'nearby' | 'city' | 'further';

export type AccommodationOption = {
  _key?: string;
  name?: string | null;
  area?: string | null;
  distanceBand?: AccommodationDistanceBand | null;
  note?: string | null;
  url?: string | null;
};

export type Attraction = {
  _key?: string;
  name?: string | null;
  note?: string | null;
  url?: string | null;
};

export type EmergencyContact = {
  _key?: string;
  label?: string | null;
  number?: string | null;
  note?: string | null;
};

export type OpeningHoursEntry = {
  _key?: string;
  label?: string | null;
  hours?: string | null;
  note?: string | null;
};

export type ShowVisitorInfo = {
  pendingLabel?: string | null;
  researchLabel?: string | null;
  planTitle?: string | null;
  planIntro?: string | null;
  gettingThereIntro?: string | null;
  airportRoutes?: TravelRoute[] | null;
  parking?: string | null;
  publicTransport?: string | null;
  accommodationIntro?: string | null;
  accommodation?: AccommodationOption[] | null;
  attractions?: Attraction[] | null;
  emergencyContacts?: EmergencyContact[] | null;
  expectTitle?: string | null;
  expectIntro?: string | null;
  openingHours?: OpeningHoursEntry[] | null;
  admissionNote?: string | null;
  admissionLinkLabel?: string | null;
  food?: string | null;
  photographyPolicy?: string | null;
  cloakroom?: string | null;
  accessibility?: string | null;
  faqTitle?: string | null;
  faqIntro?: string | null;
  faqContactNote?: string | null;
  confirmations?: ConfirmationStatuses | null;
};

export type ShowFaqCategory =
  | 'getting-there'
  | 'tickets'
  | 'accessibility'
  | 'plant-sales'
  | 'general';

export type ShowFaq = {
  _id: string;
  question?: string | null;
  answer?: PortableTextBlock[] | null;
  category?: string | null;
  order?: number | null;
  status?: ConfirmationStatus | null;
};

// ---------------------------------------------------------------------------
// F1 (show-exhibitor-info) — /national-show/exhibitors
//
// A separate four-value status union rather than an extension of ConfirmationStatus:
// the exhibitor research has a category the visitor research did not — things the
// survey looked for and could not establish. Those are neither placeholders nor
// findings, and `question` is the only honest label for them. Unifying the two unions
// is booked as FU-3.
// ---------------------------------------------------------------------------

export type ExhibitorStatus = 'pending' | 'research' | 'question' | 'confirmed';

export type ExhibitorConfirmationBlock =
  | 'entryProcess'
  | 'fees'
  | 'classes'
  | 'judging'
  | 'eligibility'
  | 'display'
  | 'sales'
  | 'practicalities'
  | 'permits'
  | 'entryForm';

// A status read from Sanity may be absent or, after a hand-edit, unrecognised. The badge
// falls those cases through to the pending marker rather than to silence, so the wider
// `string` here is deliberate — narrowing it would push the unsafe case into a cast.
export type ExhibitorConfirmationStatuses = Partial<
  Record<ExhibitorConfirmationBlock, ExhibitorStatus | string>
>;

export type ExhibitorSection = {
  heading?: string | null;
  body?: PortableTextBlock[] | null;
};

export type ShowExhibitorDate = {
  _key?: string;
  label?: string | null;
  /** Free text, never a calendar value — see sanity/schemas/objects/showExhibitorDate.ts. */
  dateNote?: string | null;
  detail?: string | null;
  status?: ExhibitorStatus | string | null;
};

export type ExhibitorQuestion = {
  _key?: string;
  question?: string | null;
  context?: string | null;
  topic?: string | null;
  order?: number | null;
};

export type ShowExhibitorStep = {
  _id: string;
  title?: string | null;
  when?: string | null;
  body?: PortableTextBlock[] | null;
  order?: number | null;
  status?: ExhibitorStatus | string | null;
};

export type ShowExhibitorInfo = {
  title?: string | null;
  intro?: string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
  questionLabel?: string | null;
  keyDatesHeading?: string | null;
  keyDatesNote?: string | null;
  keyDatesCaption?: string | null;
  keyDates?: ShowExhibitorDate[] | null;
  entryFormHeading?: string | null;
  entryFormFileUrl?: string | null;
  entryFormFileName?: string | null;
  entryFormUrl?: string | null;
  entryFormPendingNote?: string | null;
  entryProcess?: ExhibitorSection | null;
  fees?: ExhibitorSection | null;
  classes?: ExhibitorSection | null;
  judging?: ExhibitorSection | null;
  eligibility?: ExhibitorSection | null;
  display?: ExhibitorSection | null;
  sales?: ExhibitorSection | null;
  practicalities?: ExhibitorSection | null;
  permits?: ExhibitorSection | null;
  questionsHeading?: string | null;
  questionsIntro?: string | null;
  openQuestions?: ExhibitorQuestion[] | null;
  confirmations?: ExhibitorConfirmationStatuses | null;
  judgingLinkLabel?: string | null;
  classesLinkLabel?: string | null;
  contactNote?: string | null;
};

// F7 (show-visitor-info round 2): the show-identity facts every surface outside
// /national-show needs from the nationalShow singleton. Home, the utility bar and both
// archive pages carried these as hardcoded literals until round 2 — changing the venue
// or the dates is a Studio edit, so every surface reads this shape.
// See contracts/golden/show-visitor-info/show-identity-surfaces.golden.md.
export type ShowIdentity = {
  showDate?: string | null;
  showEndDate?: string | null;
  edition?: number | null;
  hostRegion?: string | null;
  /** Legacy display string. Fallback only — always prefer `venue.name`. */
  location?: string | null;
  venue?: ShowVenue | null;
  countdownDate?: string | null;
};

// ---------------------------------------------------------------------------
// F4 (vendor-registration) — vendorSubmissions data model.
// Mirrors the 2027 SAOC National Show vendor registration form's 31 fields,
// grouped by the form's own five sections. See
// contracts/golden/vendor-f4-submissions-model/README.md for the field-by-field
// verification against the source document and every judgement call recorded
// here (booth type as a closed union, boothCount/tableCount/chairCount/
// staffPerDay as number, why status/submittedAt are system-owned, not
// submitter-supplied).
// ---------------------------------------------------------------------------

export type VendorCategory =
  | 'plant-sales'
  | 'product-sales'
  | 'rare-exotic-plants'
  | 'food-retailer'
  | 'hardware'
  | 'books'
  | 'art'
  | 'other';

export type VendorBoothType = 'standard' | 'corner' | 'end-of-row';

export type VendorPaymentMethod = 'cash' | 'card' | 'eft' | 'not-applicable';

export type VendorSubmissionStatus = 'submitted' | 'under-review' | 'approved' | 'rejected';

export interface VendorSubmission {
  id: string;

  // Section 1 — business & contact details (fields 1-10).
  businessName: string;
  tradingName?: string;
  contactPersonName: string;
  contactCellPhone: string;
  contactEmail: string;
  physicalAddress?: string;
  cipcNumber?: string;
  vatNumber?: string;
  website?: string;
  socialMediaHandle?: string;

  // Section 2 — products & regulatory permits (fields 11-16).
  vendorCategory: VendorCategory[];
  productDescription: string;
  phytosanitaryPermitNumber?: string;
  citesPermitNumber?: string;
  foodHandlingCertificateNumber?: string;
  foodItemList?: string;

  // Section 3 — booth & logistics requirements (fields 17-27).
  boothCount: number;
  boothType?: VendorBoothType;
  tableCount?: number;
  chairCount?: number;
  powerRequired: boolean;
  electricalLoad?: string;
  waterRequired?: boolean;
  staffPerDay?: number;
  vehicleRegistrations?: string;
  loadInSlot?: string;
  loadOutSlot?: string;

  // Section 4 — bio & payment (fields 28-30).
  bio?: string;
  paymentMethodsAccepted?: VendorPaymentMethod[];
  paymentReference?: string;

  // Section 5 — terms & conditions (field 31).
  termsAccepted: boolean;

  // System-owned fields — never submitter-supplied. See
  // lib/vendor-submissions.ts's buildVendorSubmission() for why these are
  // structurally excluded from VendorSubmissionDraft, not merely optional.
  status: VendorSubmissionStatus;
  submittedAt: Date;

  // F6 (vendor-registration) — review-workflow fields, additive-only. Set by
  // lib/vendor-review.ts's decideVendorStatusTransition() patch, applied via
  // ref.update() — never present on a freshly-submitted document.
  reviewedBy?: string | null;
  reviewedAt?: Date | null;

  // F7 (vendor-registration) — booth fee payment path, additive-only. proofOfPaymentPath/
  // proofOfPaymentUploadedAt are set by the PUBLIC proof-of-payment upload route
  // (app/api/vendors/[id]/proof-of-payment/route.ts) via lib/vendor-proof-of-payment-handler.ts.
  // boothNumber/paymentReceived/paymentConfirmedBy/paymentConfirmedAt are office-use fields,
  // set ONLY by the capability-gated admin payment route
  // (app/api/admin/vendors/[id]/payment/route.ts) via lib/vendor-payment.ts's
  // decideVendorPaymentUpdate() — never by the public submitter or the public upload route.
  proofOfPaymentPath?: string | null;
  proofOfPaymentUploadedAt?: Date | null;
  boothNumber?: string | null;
  paymentReceived?: boolean;
  paymentConfirmedBy?: string | null;
  paymentConfirmedAt?: Date | null;
}
