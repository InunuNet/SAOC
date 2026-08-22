// A10 — COMPILER-DRIVEN proof that the Ozow adapter structurally satisfies PaymentProvider. Not a
// grep: a grep for `initiate(` would be satisfied by a method with the wrong arity or a leaking
// result union. Mirrors contracts/checks/payment-seam-f1/fixtures/payment-seam-typecheck.ts's own
// discipline for PayFast. Run via its own scoped tsconfig because the root tsconfig.json excludes
// contracts/ from `pnpm type-check`.
//
// WHAT MAKES THIS FAIL: lib/ozow.ts or lib/payments/ozow.ts not existing (unresolved imports);
// createOzowProvider()'s return not structurally satisfying PaymentProvider; refund()/
// confirmNotification() no longer returning the exact declared-stub shape this feature commits to
// (checks 3, 4); readiness() turning async or losing its ProviderOperation argument.
//
// Run as: npx tsc --noEmit -p contracts/checks/ozow-m1-f1/tsconfig.typecheck.json

import { createOzowProvider, ozowProvider } from '../../../../lib/payments/ozow';
import type {
  ConfirmResult,
  InitiateInput,
  InitiateResult,
  NotificationRequestLike,
  PaymentProvider,
  ProviderOperation,
  ProviderReadiness,
  RefundInput,
  RefundResult,
  VerifyNotificationResult,
} from '../../../../lib/payments/types';

// 1. The adapter and the factory's return both satisfy the neutral interface.
const fromFactory: PaymentProvider = createOzowProvider();
const fromDefault: PaymentProvider = ozowProvider;

// 2. readiness is SYNCHRONOUS (never returns a Promise a caller could forget to await — it sits in
//    front of every checkout) and takes the ProviderOperation union, not an arbitrary string.
function readinessShape(op: ProviderOperation): ProviderReadiness {
  return fromFactory.readiness(op);
}
// @ts-expect-error — readiness must reject an arbitrary string.
fromFactory.readiness('refund');
// @ts-expect-error — readiness must reject an arbitrary string.
fromFactory.readiness('something-else');

// 3. InitiateResult narrows by `ok`.
async function initiateNarrowing(input: InitiateInput): Promise<string> {
  const result: InitiateResult = await fromFactory.initiate(input);
  if (!result.ok) {
    // @ts-expect-error — a refusal carries no fields.
    result.fields;
    return result.reason;
  }
  const fields: Readonly<Record<string, string>> = result.fields;
  const method: 'POST' = result.method;
  return `${result.processUrl}${method}${Object.keys(fields).length}`;
}

// 4. VerifyNotificationResult narrows by `verified`.
async function verifyNarrowing(request: NotificationRequestLike): Promise<string> {
  const result: VerifyNotificationResult = await fromDefault.verifyNotification(request);
  if (!result.verified) {
    // @ts-expect-error — a failure carries no notification.
    result.notification;
    return result.reason;
  }
  // @ts-expect-error — a success arm carries no `reason`.
  result.reason;
  const gross: string | null = result.notification.grossAmount;
  const cents: number | null = result.notification.grossAmountCents;
  return `${result.notification.reference}${gross}${cents}`;
}

// 5. confirmNotification's declared-stub shape in THIS feature: always { confirmed: false,
//    reason: 'not-configured' }. RefundResult and ConfirmResult still narrow by discriminant.
async function confirmDeclaredStub(request: NotificationRequestLike): Promise<boolean> {
  const verified = await fromFactory.verifyNotification(request);
  if (!verified.verified) return false;
  const result: ConfirmResult = await fromFactory.confirmNotification(verified.notification);
  if (result.confirmed) {
    // @ts-expect-error — a confirmed result carries no `reason`.
    result.reason;
    return true;
  }
  const reason: 'not-valid' | 'request-failed' | 'not-configured' = result.reason;
  return reason === 'not-configured';
}

// 6. refund's declared-stub shape: always { ok: false, reason: 'not-supported' }.
async function refundDeclaredStub(input: RefundInput): Promise<'not-supported'> {
  const result: RefundResult = await fromFactory.refund(input);
  if (result.ok) {
    // @ts-expect-error — a success result carries no `reason`.
    result.reason;
    throw new Error('unreachable in this feature');
  }
  // @ts-expect-error — a refusal carries no providerRefundId.
  result.providerRefundId;
  if (result.reason !== 'not-supported') throw new Error('this feature always refuses not-supported');
  return result.reason;
}

void readinessShape;
void initiateNarrowing;
void verifyNarrowing;
void confirmDeclaredStub;
void refundDeclaredStub;
