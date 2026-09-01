/**
 * M3 (vendor-gated-registration-flow, F26) -- the SOLE source of truth for the three
 * booth-size stand fees. See contracts/golden/vendor-gated-registration-flow-m3/README.md
 * "The missing-figure problem" for the full decision record.
 *
 * Council-blocked. Every value is null until the Show Organising Committee confirms a real
 * ZAR figure per booth size -- the 26 Aug source document's entire "Booth Fees & Payment"
 * section was REMOVED between the 25 Aug and 26 Aug revisions, so there is zero figure
 * anywhere in the canonical document to anchor even an estimate to. Do NOT fill these with an
 * invented or estimated number, unlike lib/provisional-figures.ts's flagged-provisional
 * pattern -- that pattern is for numbers this project chose to estimate and disclose; there is
 * no estimate to disclose here.
 *
 * Pure, side-effect-free -- no Firestore import, no network, no Date.now()/new Date() call
 * anywhere in this file.
 */

export const VENDOR_STAND_BOOTH_SIZES = [1, 2, 3] as const;

export type VendorStandBoothSizeValue = (typeof VENDOR_STAND_BOOTH_SIZES)[number];

export const VENDOR_STAND_PRICE_ZAR: Record<VendorStandBoothSizeValue, number | null> = {
  1: null,
  2: null,
  3: null,
};

// Verbatim source labels (the 26 Aug source doc's three booth options), used both by the
// public payment page (F29) and anywhere else this project needs to display a booth-size
// choice -- a single source of truth so the labels can never drift between call sites.
export const VENDOR_STAND_BOOTH_SIZE_LABELS: Record<VendorStandBoothSizeValue, string> = {
  1: 'Single Booth – 2.5m x 3m',
  2: '2 Booths (Double) – 5m x 3m',
  3: '3 Booths (Triple) – 7m x 3m',
};

export type VendorStandPriceResolution =
  | { ok: true; amount: number }
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
 * lib/payments/active-gateway.ts's resolveActiveGateway(). A caller that mistook "not yet
 * priced" for "assume some figure" is exactly the defect this exists to rule out.
 *
 * Rejects anything that is not exactly one of the closed `{1,2,3}` numeric set -- including a
 * value that happens to be numerically 1|2|3 but arrives as a string, NaN, or out of range --
 * with 'invalid-booth-size', distinct from the council-blocked 'not-configured' reason so a
 * caller never conflates "you sent a bad size" with "we haven't priced this yet."
 */
export function resolveVendorStandPrice(boothSize: unknown): VendorStandPriceResolution {
  if (!isValidBoothSize(boothSize)) {
    return { ok: false, reason: 'invalid-booth-size' };
  }

  const amount = VENDOR_STAND_PRICE_ZAR[boothSize];
  if (amount === null) {
    return { ok: false, reason: 'not-configured' };
  }

  return { ok: true, amount };
}
