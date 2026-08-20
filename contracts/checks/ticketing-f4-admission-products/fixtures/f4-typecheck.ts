// ticketing-f4-admission-products (architect contract) — compiler-driven (not source-grep)
// proof of the new F4 exported shapes. Companion to the runtime checks (A4/A5/A7/A8/A9), which
// prove BEHAVIOUR and DATA; this proves the TYPES those are pinned to.
//
// Run as: npx tsc --noEmit -p contracts/checks/ticketing-f4-admission-products/tsconfig.typecheck.json

import type { ProvisionalAdmissionProduct } from '../../../../lib/provisional-figures';
import { ADMISSION_PRODUCTS, EARLY_BIRD_CUTOFF } from '../../../../lib/provisional-figures';

import { effectiveCapacity, isWithinEarlyBirdWindow } from '../../../../lib/checkout-reservation';

import type { TicketTypeCardData } from '../../../../components/tickets/TicketTypeCard';

// --- ProvisionalAdmissionProduct: provisional is the literal `true`, not a plain boolean — a
// --- future value that flips it to false would be a schema-shape change, not merely a data
// --- edit, and this pins that today's file-level constant genuinely cannot represent `false`. ---

const sample: ProvisionalAdmissionProduct = ADMISSION_PRODUCTS[0];
void sample;

// Isolated to a single-property assignment (rather than embedding `provisional: false` inside
// the full multi-property object literal above) because tsc attributes a TS2322 mismatch on ONE
// mismatched property within an otherwise-valid multi-property literal to THAT PROPERTY's own
// line, not the `const` declaration line — `@ts-expect-error` only suppresses a diagnostic on
// the very next line, so placed above a multi-line literal it never matches the error's real
// line and reports itself as an unused directive instead (confirmed: tsc 5.9.3). Narrowing to
// `Pick<..., 'provisional'>` keeps the assignment to exactly one property, so the mismatch and
// the directive land on the same line.
// @ts-expect-error — provisional must be the literal `true`, assigning `false` must not compile
// against ProvisionalAdmissionProduct's own declared shape (today's stage-of-project constraint,
// see golden README "The provisional flag is per-value...").
const badProvisional: Pick<ProvisionalAdmissionProduct, 'provisional'> = { provisional: false };
void badProvisional;

void (EARLY_BIRD_CUTOFF as string);

// --- effectiveCapacity()/isWithinEarlyBirdWindow() signatures ---

const cap: number = effectiveCapacity(400, 150);
void cap;
const capNullReleased: number = effectiveCapacity(800, null);
void capNullReleased;

const withinWindow: boolean = isWithinEarlyBirdWindow(new Date(), '2027-07-31');
void withinWindow;
const withinWindowNullCutoff: boolean = isWithinEarlyBirdWindow(new Date(), null);
void withinWindowNullCutoff;

// --- TicketTypeCardData carries `provisional` ---

const cardData: TicketTypeCardData = {
  slug: 'early-bird',
  name: 'Early-Bird Exhibition Ticket',
  price: 130,
  description: 'One-day admission at the early-bird rate.',
  soldOut: false,
  provisional: true,
};
void cardData;

// @ts-expect-error — TicketTypeCardData must require `provisional` (no accidental optionality
// that would let the UI gate silently degrade to "never show the badge").
const cardDataMissingProvisional: TicketTypeCardData = {
  slug: 'day-visitor',
  name: 'Day Visitor Ticket',
  price: 150,
  description: 'Single-day admission.',
  soldOut: false,
};
void cardDataMissingProvisional;
