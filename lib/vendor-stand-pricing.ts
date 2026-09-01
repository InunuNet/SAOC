/**
 * M3 (vendor-gated-registration-flow, F26) -- originally the SOLE source of truth for the
 * three booth-size stand fees. See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "The missing-figure problem"
 * for that history.
 *
 * vendor-stand-early-bird-pricing (M1/F1, REVISION 2026-09-01) adds the early-bird/regular
 * tier axis. Brad confirmed real figures mid-mission -- nothing here is council-blocked any
 * more. See contracts/golden/vendor-stand-early-bird-pricing/README.md for the full decision
 * record.
 *
 * All six prices are DERIVED from one confirmed per-stand rate and one confirmed discount
 * percentage, in integer cents throughout -- never six independently hand-maintained figures
 * (drift risk) and never float rand arithmetic in the payment path. `resolveVendorStandPrice`'s
 * public `amount` stays a rand `number` (dividing by 100 once, at the boundary) so no other
 * call site (route, gateway, admin display) needs to know cents exist.
 *
 * Pure, side-effect-free -- no Firestore import, no network, no Date.now()/new Date() call
 * anywhere in this file. `now` AND `cutoffIso` are REQUIRED parameters on
 * resolveVendorStandPrice(), both supplied by the caller -- this module has no clock and no
 * cutoff of its own, so nothing inside it can be spoofed.
 */

// Relative, not '@/'-aliased: A1-A4's check scripts import this module directly via
// `tsx/esm`, outside of Next.js's own module resolution, which is the only place the '@/*'
// path alias (tsconfig.json) is honoured at runtime. This is a real value import (not
// `import type`), so it must resolve without the alias -- see lib/show-window-lookup.ts's
// top-of-file comment for the same constraint on the same class of import.
import { isWithinEarlyBirdWindow } from './checkout-reservation';

export const VENDOR_STAND_BOOTH_SIZES = [1, 2, 3] as const;

export type VendorStandBoothSizeValue = (typeof VENDOR_STAND_BOOTH_SIZES)[number];

export type VendorStandPricingTier = 'earlyBird' | 'regular';

// Confirmed 2026-09-01 (Brad). Integer cents -- R1450.00 = 145000 -- so no arithmetic in the
// payment path ever depends on IEEE-754 float rounding.
export const VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS = 145000;
export const VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT = 20;

function standardPriceZarCents(boothSize: VendorStandBoothSizeValue): number {
  return VENDOR_STAND_PER_STAND_RATE_ZAR_CENTS * boothSize; // exact, integer x integer
}

function earlyBirdPriceZarCents(boothSize: VendorStandBoothSizeValue): number {
  // Integer cents throughout: (cents * 80) / 100 is always exact for every boothSize in
  // {1,2,3} against this rate (145000*80/100 = 116000, etc.) -- Math.round is defensive, not
  // load-bearing, in case a future rate change ever produces a fractional cent.
  return Math.round(
    (standardPriceZarCents(boothSize) * (100 - VENDOR_STAND_EARLY_BIRD_DISCOUNT_PERCENT)) / 100,
  );
}

// Confirmed, Brad 2026-09-01. Deliberately NOT shared with
// lib/vendor-stand-forfeiture-notice.ts's own "90 days" cancellation-window figure -- two
// unrelated rules that happen to share a number today. Never import this file from that one,
// or vice versa, for either value.
export const VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW = 90;

// South Africa Standard Time -- UTC+2, no daylight saving, ever. This is the ONE place the
// offset is applied.
const SAST_OFFSET = '+02:00';

/**
 * Pure. `showStartDate` is supplied by the caller (resolved from the active show's
 * ShowWindow via lib/show-window-lookup.ts), never fetched here. Returns an ISO 8601 string
 * with an EXPLICIT +02:00 offset -- never bare UTC/'Z' -- so that when this string is handed
 * to isWithinEarlyBirdWindow(), the boundary it computes lands at SAST midnight, not UTC
 * midnight (a Firebase App Hosting container runs UTC; a bare UTC boundary would be 2 hours
 * off). See the golden README's "SAST boundary" for the full walkthrough.
 */
export function deriveVendorStandEarlyBirdCutoffIso(showStartDate: Date): string {
  const cutoff = new Date(
    Date.UTC(
      showStartDate.getUTCFullYear(),
      showStartDate.getUTCMonth(),
      showStartDate.getUTCDate() - VENDOR_STAND_EARLY_BIRD_CUTOFF_DAYS_BEFORE_SHOW,
    ),
  );
  const yyyy = cutoff.getUTCFullYear();
  const mm = String(cutoff.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(cutoff.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T00:00:00${SAST_OFFSET}`;
}

// Verbatim source labels (the 26 Aug source doc's three booth options), used both by the
// public payment page (F29) and anywhere else this project needs to display a booth-size
// choice -- a single source of truth so the labels can never drift between call sites.
export const VENDOR_STAND_BOOTH_SIZE_LABELS: Record<VendorStandBoothSizeValue, string> = {
  1: 'Single Booth – 2.5m x 3m',
  2: '2 Booths (Double) – 5m x 3m',
  3: '3 Booths (Triple) – 7m x 3m',
};

export type VendorStandPriceResolution =
  | { ok: true; amount: number; tier: VendorStandPricingTier }
  | { ok: false; reason: 'not-configured' | 'invalid-booth-size' };

function isValidBoothSize(value: unknown): value is VendorStandBoothSizeValue {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (VENDOR_STAND_BOOTH_SIZES as readonly number[]).includes(value)
  );
}

/**
 * Never throws, never guesses, never falls back to a default price -- same posture as
 * lib/payments/active-gateway.ts's resolveActiveGateway(). Rejects anything that is not
 * exactly one of the closed `{1,2,3}` numeric set with 'invalid-booth-size', distinct from
 * 'not-configured' so a caller never conflates "you sent a bad size" with "we can't price
 * this right now."
 *
 * All six prices are confirmed constants now -- they can never be null again. The only
 * remaining `not-configured` path is a null `cutoffIso` (the active show's window couldn't be
 * resolved, e.g. no show published in Sanity) -- this is where M3's original "never guess,
 * never fall back" discipline now lives. `now` and `cutoffIso` must both come from the
 * caller's own trusted server-side resolution, never a client-supplied value -- see
 * contracts/golden/vendor-stand-early-bird-pricing/README.md.
 */
export function resolveVendorStandPrice(
  boothSize: unknown,
  now: Date,
  cutoffIso: string | null,
): VendorStandPriceResolution {
  if (!isValidBoothSize(boothSize)) {
    return { ok: false, reason: 'invalid-booth-size' };
  }
  if (cutoffIso === null) {
    return { ok: false, reason: 'not-configured' };
  }
  const tier: VendorStandPricingTier = isWithinEarlyBirdWindow(now, cutoffIso) ? 'earlyBird' : 'regular';
  const cents = tier === 'earlyBird' ? earlyBirdPriceZarCents(boothSize) : standardPriceZarCents(boothSize);
  return { ok: true, amount: cents / 100, tier };
}
