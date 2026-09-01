/**
 * M3 (vendor-gated-registration-flow, F29) -- the 90-day forfeiture notice, quoted VERBATIM
 * from docs/leeann-source/2027-vendor-registration-form_2026-08-26.md lines 242-243 (the
 * "Cancellation and Refunds" clause's first two operative sentences). See
 * contracts/golden/vendor-gated-registration-flow-m3/README.md "The 90-day forfeiture notice"
 * for why this is a SECOND, independent placement from F20/M2's T&Cs-block copy (rendered on
 * the payment page itself, the moment money is about to move) -- not a duplicate of it.
 *
 * This is the ONLY place this sentence is defined -- every renderer must import this constant,
 * never retype the text inline.
 */
export const VENDOR_STAND_FORFEITURE_NOTICE =
  'All vendor registrations and payments must be finalised no later than 90 days before the ' +
  'opening of the show. Cancellations received within 90 days of the show will not qualify ' +
  'for a refund.';
