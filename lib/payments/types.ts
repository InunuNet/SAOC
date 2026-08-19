/**
 * Gateway-neutral payment provider surface.
 *
 * Drawn against three real redirect-plus-webhook gateways — the one this project uses today
 * and the two the council is most likely to move to next — rather than against any single
 * one of them. Nothing gateway-specific may appear in this file: the moment a provider's own
 * vocabulary leaks in, the abstraction is that provider wearing a coat and the second
 * integration reopens the interface instead of implementing it.
 *
 * Normative source: contracts/golden/payment-seam-f1/interface.golden.md.
 */

/** Provider-neutral settled state. Deliberately NOT the gateway's own vocabulary. */
export type PaymentStatus = 'paid' | 'pending' | 'failed' | 'cancelled' | 'unknown';

export interface InitiateInput {
  /** Our own order reference, echoed back to us on the gateway's notification. */
  readonly reference: string;
  /** Money as an already-formatted 2dp decimal string. The caller owns formatting —
   *  today's route does `amount.toFixed(2)` and that must not move or change. */
  readonly amountFormatted: string;
  readonly itemName: string;
  readonly returnUrl: string;
  readonly cancelUrl: string;
  readonly notifyUrl: string;
}

export type InitiateResult =
  | {
      readonly ok: true;
      /** Hosted page the browser is handed off to. */
      readonly processUrl: string;
      readonly method: 'POST';
      /** Signed form fields IN SIGNATURE ORDER. Insertion order is load-bearing. */
      readonly fields: Readonly<Record<string, string>>;
    }
  | { readonly ok: false; readonly reason: 'not-configured' };

/** Structural, so the route can pass a NextRequest without lib/payments importing next. */
export interface NotificationRequestLike {
  readonly rawBody: string;
  readonly headers: { get(name: string): string | null };
}

export interface ProviderNotification {
  readonly reference: string;
  readonly rawStatus: string | null;
  /** Gross amount exactly as the gateway sent it — an unparsed string, kept for logging only. */
  readonly grossAmount: string | null;
  /** The gateway's decimal-string amount translated to integer cents by the adapter — format
   *  translation, the same category as mapStatus translating the gateway's status vocabulary.
   *  null when the raw string could not be parsed. The caller does the numeric comparison
   *  against its own stored amount; the provider never decides whether an amount is
   *  acceptable — computing cents is not deciding acceptability. */
  readonly grossAmountCents: number | null;
  readonly gatewayPaymentId: string | null;
  readonly sourceIp: string | null;
  /** null = could not be determined (no client IP, or resolution failed). This is
   *  advisory only — today's route LOGS it and never rejects on it. */
  readonly sourceIpTrusted: boolean | null;
  /** Every posted field, in posted order, excluding the signing field. */
  readonly raw: Readonly<Record<string, string>>;
}

export type VerifyFailureReason =
  | 'not-configured'
  | 'missing-signature'
  | 'signature-mismatch'
  | 'missing-reference';

export type VerifyNotificationResult =
  | {
      readonly verified: false;
      readonly reason: VerifyFailureReason;
      readonly reference: string | null;
    }
  | { readonly verified: true; readonly notification: ProviderNotification };

export type ConfirmResult =
  | { readonly confirmed: true }
  | { readonly confirmed: false; readonly reason: 'not-valid' | 'request-failed' | 'not-configured' };

export interface RefundInput {
  readonly reference: string;
  readonly gatewayPaymentId: string | null;
  readonly amountFormatted: string;
}

export type RefundResult =
  | { readonly ok: true; readonly providerRefundId: string }
  | { readonly ok: false; readonly reason: 'not-supported' | 'not-configured' | 'request-failed' };

/** The operations a caller can ask a provider whether it is configured to perform.
 *  Deliberately NOT a single global "is this provider configured?": one gateway can need one set
 *  of credentials to start a payment and a different secret to authenticate a notification, and
 *  those sets differ. All three target gateways split the same way. `refund` is absent because
 *  refund itself is a declared-unsupported stub — inventing readiness semantics for an
 *  unimplemented operation would be guessing. */
export type ProviderOperation = 'initiate' | 'verify-notification';

export type ProviderReadiness =
  | { readonly ready: true }
  | {
      readonly ready: false;
      readonly reason: 'not-configured';
      /** Names the absent configuration keys, so an operator can act on the log line without a
       *  debugger. A bare boolean here would be a worse answer to the same question. */
      readonly missing: readonly string[];
    };

export interface PaymentProvider {
  readonly id: string;
  /** Can this provider perform `operation` right now? SYNCHRONOUS and OFFLINE by contract: it sits
   *  in front of every checkout, so it must not cost a network round trip, and it must not be a
   *  promise a caller could forget to await (a forgotten await is always truthy — it fails open). */
  readiness(operation: ProviderOperation): ProviderReadiness;
  initiate(input: InitiateInput): Promise<InitiateResult>;
  verifyNotification(request: NotificationRequestLike): Promise<VerifyNotificationResult>;
  /** Server-side re-confirmation of a notification, out of band from the webhook body. */
  confirmNotification(notification: ProviderNotification): Promise<ConfirmResult>;
  mapStatus(rawStatus: string | null): PaymentStatus;
  refund(input: RefundInput): Promise<RefundResult>;
}
