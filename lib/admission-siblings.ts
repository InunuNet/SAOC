// The two early-bird SKUs and the standard SKU whose live price backs their `regularPrice`
// (golden: ticketing-flow-redesign pricing model). One source of truth for the ticket page
// view-model and the tickets hub rows. Relative-import safe: no Sanity or Firebase imports.
export const REGULAR_PRICE_SIBLING_SLUG: Record<string, string> = {
  'weekend-pass-early-bird': 'weekend-pass',
  'early-bird': 'day-visitor',
};
