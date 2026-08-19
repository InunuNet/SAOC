// A11 — COMPILER-DRIVEN proof of the seam's exported shape. Not a grep: a grep for
// `initiate(` would be satisfied by a method with the wrong arity, the wrong argument type, or a
// result union whose arms leak into each other. Run via its own scoped tsconfig because the root
// tsconfig.json excludes contracts/ from `pnpm type-check`.
//
// WHAT MAKES THIS FAIL: lib/payments/ not existing (pre-move — the imports do not resolve, which
// is how this assertion is observed failing against unfixed code); any method renamed or given a
// different arity; a result union collapsed into one non-discriminated shape (checks 3, 4, 6, 7b);
// the adapter no longer structurally satisfying PaymentProvider (check 1); the default export in
// index.ts not being a PaymentProvider (check 2); readiness turning async, losing its operation
// argument, accepting an arbitrary string, or its verdict arms leaking into each other (7b).
//
// Run as: npx tsc --noEmit -p contracts/checks/payment-seam-f1/tsconfig.typecheck.json

import { paymentProvider } from '../../../../lib/payments';
import { createPayfastProvider, payfastProvider } from '../../../../lib/payments/payfast';
import type {
  ConfirmResult,
  InitiateInput,
  InitiateResult,
  NotificationRequestLike,
  PaymentProvider,
  PaymentStatus,
  ProviderNotification,
  ProviderOperation,
  ProviderReadiness,
  RefundInput,
  RefundResult,
  VerifyNotificationResult,
} from '../../../../lib/payments/types';

// 1. The adapter and the factory's return both satisfy the neutral interface.
const fromFactory: PaymentProvider = createPayfastProvider();
const fromDefault: PaymentProvider = payfastProvider;

// 2. The single config point exports a PaymentProvider, not a PayFast-shaped thing.
const configured: PaymentProvider = paymentProvider;

// 3. InitiateResult narrows by `ok`, and neither arm leaks the other's fields.
async function initiateNarrowing(input: InitiateInput): Promise<string> {
  const result: InitiateResult = await configured.initiate(input);
  if (!result.ok) {
    // @ts-expect-error — a refusal carries no fields; leaking them here is the defect.
    result.fields;
    return result.reason;
  }
  const fields: Readonly<Record<string, string>> = result.fields;
  const method: 'POST' = result.method;
  return `${result.processUrl}${method}${Object.keys(fields).length}`;
}

// 4. VerifyNotificationResult narrows by `verified`.
async function verifyNarrowing(request: NotificationRequestLike): Promise<string> {
  const result: VerifyNotificationResult = await fromFactory.verifyNotification(request);
  if (!result.verified) {
    // @ts-expect-error — a failure carries no notification.
    result.notification;
    return result.reason;
  }
  const notification: ProviderNotification = result.notification;
  // @ts-expect-error — a success arm carries no `reason`.
  result.reason;
  const trusted: boolean | null = notification.sourceIpTrusted;
  const gross: string | null = notification.grossAmount;
  // grossAmountCents — added F2 window (2026-08-20): the adapter's own translation of the
  // gateway's decimal string into an integer count of cents. Must type as number | null, not
  // string, or a route reading it would silently fall back to string comparison.
  const grossCents: number | null = notification.grossAmountCents;
  return `${notification.reference}${trusted}${gross}${grossCents}`;
}

// 5. confirmNotification takes the notification the verify step produced — not a request, and not
//    a raw body. That coupling is what keeps the confirm body byte-identical to the digest body.
async function confirmShape(notification: ProviderNotification): Promise<boolean> {
  const result: ConfirmResult = await fromDefault.confirmNotification(notification);
  return result.confirmed;
}

// 6. RefundResult narrows by `ok`.
async function refundNarrowing(input: RefundInput): Promise<string> {
  const result: RefundResult = await configured.refund(input);
  if (result.ok) return result.providerRefundId;
  // @ts-expect-error — a refusal carries no refund id.
  result.providerRefundId;
  return result.reason;
}

// 7. mapStatus is synchronous, accepts null, and returns the neutral union — never the gateway's
//    own vocabulary.
const mapped: PaymentStatus = configured.mapStatus(null);
// @ts-expect-error — 'COMPLETE' is PayFast's word, not the seam's.
const notAStatus: PaymentStatus = 'COMPLETE';

// 7b. readiness — the sixth member, at TYPE level. A8 proves its BEHAVIOUR; nothing proved its
//     SHAPE, so the fixture never mentioned it and the compiler-driven member proof passed without
//     exercising it at all. Arity, the ProviderOperation argument and the `ready` discriminant are
//     all asserted here.
//
//     SYNCHRONOUS is load-bearing and is asserted by the ANNOTATION, not by a comment: this probe
//     sits in front of every checkout, and a promise a caller forgets to await is always truthy —
//     it fails open. Declaring the result as ProviderReadiness (never Promise<ProviderReadiness>)
//     breaks the build the moment the member turns async.
const readinessNow: ProviderReadiness = configured.readiness('initiate');

// The argument is the ProviderOperation union, not a string. `refund` is deliberately OUT of the
// union — it is a declared-unsupported stub, and inventing readiness semantics for an unimplemented
// operation would be guessing.
const verifyOperation: ProviderOperation = 'verify-notification';
const readinessForVerify: ProviderReadiness = fromFactory.readiness(verifyOperation);
// @ts-expect-error — 'refund' is not a ProviderOperation.
fromDefault.readiness('refund');
// @ts-expect-error — an arbitrary string is not a ProviderOperation either.
fromDefault.readiness('initiate-payment');
// @ts-expect-error — the operation is required; a global "is this configured?" is not the contract.
fromDefault.readiness();

// ProviderReadiness narrows by `ready`, and neither arm leaks the other's fields — the same
// discriminated-union proof the result types above get.
function readinessNarrowing(verdict: ProviderReadiness): string {
  if (!verdict.ready) {
    const reason: 'not-configured' = verdict.reason;
    // `missing` names the absent keys so an operator can act on the log line without a debugger.
    const missing: readonly string[] = verdict.missing;
    return `${reason}:${missing.join(',')}`;
  }
  // @ts-expect-error — a ready verdict carries no `reason`.
  verdict.reason;
  // @ts-expect-error — nor a `missing` list.
  verdict.missing;
  return 'ready';
}

// 8. The interface does not import Next.js types: a plain object satisfies NotificationRequestLike.
const plainRequest: NotificationRequestLike = {
  rawBody: 'a=1',
  headers: { get: () => null },
};

export const _used = [
  readinessNow,
  readinessForVerify,
  readinessNarrowing,
  initiateNarrowing,
  verifyNarrowing,
  confirmShape,
  refundNarrowing,
  mapped,
  notAStatus,
  plainRequest,
  fromFactory,
  fromDefault,
  configured,
];
