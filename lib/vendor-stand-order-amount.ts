/**
 * Notification amount guard for vendor stand orders. Same rule as the ticket path's
 * notificationAmountMatches: an order is compared against the amount we told the gateway to
 * expect (`expectedGatewayAmount`, set only under the Ozow Sandbox Test Mode) and otherwise
 * against its real `amount`, so orders that predate the field behave exactly as before.
 * No imports: loadable by plain node.
 */
export function vendorStandOrderAmountMatches(
  order: { amount?: unknown; expectedGatewayAmount?: unknown },
  grossAmountCents: number | null,
): boolean {
  if (grossAmountCents === null) return false;
  const expected = order.expectedGatewayAmount ?? order.amount;
  if (typeof expected !== 'number' || !Number.isFinite(expected)) return false;
  return Math.round(expected * 100) === grossAmountCents;
}
