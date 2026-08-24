/**
 * Mission ozow-sandbox-toggle F1. See contracts/golden/ozow-sandbox-toggle-f1/README.md §3d for
 * the full decision record. Client-safe module: zero server-only imports. Split out of
 * lib/ozow-sandbox-test-mode.ts so a 'use client' importer never pulls the Firebase Admin SDK
 * into the browser bundle.
 */
export const OZOW_SANDBOX_TEST_MODE_COLLECTION = 'adminSettings';
export const OZOW_SANDBOX_TEST_MODE_DOC_ID = 'ozowSandboxTestMode';

export const OZOW_SANDBOX_TEST_MODE_BANNER_TEXT =
  'TEST MODE — Ozow charges R0.01 instead of the displayed price';

const OZOW_SANDBOX_TEST_AMOUNT = '0.01';

/**
 * Pure function: resolves the amount to hand to `paymentProvider.initiate()`. Takes the
 * ALREADY-RESOLVED `expectedGatewayAmount` directly — the same value that is, or will be,
 * stored on the order — rather than re-deriving "should I override" from a providerId/flag
 * pair. See README §3c: this is what guarantees a replay can never disagree with what's
 * already committed to its order, since there is no second, independent flag read for it to
 * disagree with. `null` (the only value for PayFast, or Ozow with the flag off) passes
 * `realAmountFormatted` through unchanged; any non-null value returns the fixed
 * `'0.01'` override, regardless of `realAmountFormatted`.
 */
export function resolveOzowInitiateAmount(
  expectedGatewayAmount: number | null,
  realAmountFormatted: string,
): string {
  if (expectedGatewayAmount === null) return realAmountFormatted;
  return OZOW_SANDBOX_TEST_AMOUNT;
}

/**
 * Pure function: resolves what we told the gateway to expect, for storage on the order —
 * see README §3b. `null` (the default, and the only value for PayFast or Ozow with the flag
 * off) means "compare notifications against `order.amount`, unchanged." Mirrors
 * `resolveOzowInitiateAmount`'s branching exactly so the two functions can never disagree
 * about *when* the override applies. `realAmount` is deliberately not a parameter — the
 * override is the fixed constant regardless of the real price.
 */
export function resolveExpectedGatewayAmount(
  providerId: string,
  testModeEnabled: boolean,
): number | null {
  if (providerId === 'ozow' && testModeEnabled) return Number(OZOW_SANDBOX_TEST_AMOUNT);
  return null;
}
