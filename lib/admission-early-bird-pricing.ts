/**
 * ticketing-complete (M1/F1) -- computed early-bird pricing engine for admission products.
 * See .agent/memory/project/specs/ticketing-complete/goldens/README.md secs 2-3 for the full
 * decision record and .../goldens/fixtures/f1-pricing-boundary-cases.json for the golden
 * truth table this must match exactly.
 *
 * Replaces the concept of separately-priced early-bird PRODUCTS with one computed discount
 * any product can carry: ONE confirmed `basePrice` plus ONE confirmed discount percentage,
 * never two independently hand-maintained prices that can drift apart. Mirrors
 * `lib/vendor-stand-pricing.ts`'s per-stand-rate pattern.
 *
 * Pure, side-effect-free -- no Firestore import, no network, no Date.now()/new Date() call
 * anywhere in this file. `purchaseDate` and `showStartDate` are REQUIRED parameters supplied
 * by the caller -- this module has no clock of its own, so nothing inside it can be spoofed.
 */

// Relative, not '@/'-aliased: this module's own check scripts import it directly via
// `tsx/esm`, outside of Next.js's own module resolution, which is the only place the '@/*'
// path alias (tsconfig.json) is honoured at runtime. This is a real value import (not
// `import type`), so it must resolve without the alias -- see lib/vendor-stand-pricing.ts's
// top-of-file comment for the same constraint on the same class of import.
import { isWithinEarlyBirdWindow } from './checkout-reservation';

export const ADMISSION_EARLY_BIRD_DISCOUNT_PERCENT = 20;

// Confirmed, mission goal string (2026-09-08): 90 days before the show's confirmed
// 2027-09-16 start = 2027-06-18 cutoff. This is its OWN constant -- deliberately NOT imported
// from, or shared with, the vendor-stand module's own early-bird cutoff day-count constant or
// the provisional refund-policy module's day thresholds, even though all three currently
// read "90" or similar -- three unrelated rules that happen to share a number today. Never
// import this constant from, or into, either of those modules (see
// lib/vendor-stand-pricing.ts's own comment for the same discipline stated from its side).
export const ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW = 90;

export type AdmissionEarlyBirdPricingTier = 'earlyBird' | 'regular';

// South Africa Standard Time -- UTC+2, no daylight saving, ever. This is the ONE place the
// offset is applied.
const SAST_OFFSET = '+02:00';
const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * Pure. `showStartDate` is supplied by the caller, never fetched here. Returns an ISO 8601
 * string with an EXPLICIT +02:00 offset -- never bare UTC/'Z' -- so that when this string is
 * handed to isWithinEarlyBirdWindow(), the boundary it computes lands at SAST midnight, not
 * UTC midnight (a Firebase App Hosting container runs UTC; a bare UTC boundary would be 2
 * hours off from the SAST calendar day this cutoff actually means).
 *
 * The calendar-day subtraction below must operate on `showStartDate`'s SAST calendar day, not
 * its UTC calendar day -- those two disagree whenever the show start falls before 02:00 SAST
 * (before 00:00 UTC on the same date). Getting this wrong is a silent off-by-one: it happens
 * to produce the right answer for a show starting mid-morning (like the real 09:00 SAST show
 * start), which is exactly why it can hide in a fixture set that never exercises an
 * early-morning start. We derive the SAST calendar day by shifting the instant forward by the
 * SAST offset before reading UTC-labelled Y/M/D components off it -- those components are then
 * genuinely the SAST wall-clock date, not the UTC one.
 */
export function deriveAdmissionEarlyBirdCutoffIso(showStartDate: Date): string {
  const sastShifted = new Date(showStartDate.getTime() + SAST_OFFSET_MS);
  const cutoff = new Date(
    Date.UTC(
      sastShifted.getUTCFullYear(),
      sastShifted.getUTCMonth(),
      sastShifted.getUTCDate() - ADMISSION_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW,
    ),
  );
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00${SAST_OFFSET}`;
}

export interface ResolveComputedEarlyBirdPriceInput {
  basePrice: number;
  purchaseDate: Date;
  showStartDate: Date;
}

export interface ResolveComputedEarlyBirdPriceResult {
  amount: number;
  tier: AdmissionEarlyBirdPricingTier;
}

/**
 * Pure function of (basePrice, purchaseDate, showStartDate) -- no network, no Sanity, no
 * implicit clock. `amount = Math.round(basePrice * 0.8)` inside the window (through the end
 * of the cutoff date, per isWithinEarlyBirdWindow's existing contract), `basePrice` outside
 * it. Reuses `isWithinEarlyBirdWindow` from lib/checkout-reservation.ts rather than
 * reimplementing the boundary comparator.
 */
export function resolveComputedEarlyBirdPrice(
  input: ResolveComputedEarlyBirdPriceInput,
): ResolveComputedEarlyBirdPriceResult {
  const cutoffIso = deriveAdmissionEarlyBirdCutoffIso(input.showStartDate);
  const withinWindow = isWithinEarlyBirdWindow(input.purchaseDate, cutoffIso);
  if (withinWindow) {
    return {
      amount: Math.round(input.basePrice * ((100 - ADMISSION_EARLY_BIRD_DISCOUNT_PERCENT) / 100)),
      tier: 'earlyBird',
    };
  }
  return { amount: input.basePrice, tier: 'regular' };
}
