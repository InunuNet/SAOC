/**
 * The provider-selection point.
 *
 * F2 (ozow-payment-provider, M2) replaces the single hardcoded `paymentProvider` const with a
 * keyed registry: Ozow is now a second, buyer-selectable provider alongside PayFast, not a
 * replacement for it. `resolveProvider` is the ONLY sanctioned way to turn a request-supplied
 * providerId into a PaymentProvider — it never throws and never falls back to a default, because
 * a caller that mistook "unknown id" for "assume PayFast" is exactly the defect this exists to
 * rule out. `Object.prototype.hasOwnProperty.call` is load-bearing, not decoration: a bare
 * bracket lookup (`paymentProviders[id]`) resolves prototype-pollution-shaped ids like
 * '__proto__'/'constructor' to inherited Object.prototype members, which are truthy and NOT null.
 * See contracts/golden/ozow-m1-f2/README.md §1.
 */
import { ozowProvider } from './ozow';
import { payfastProvider } from './payfast';

import type { PaymentProvider } from './types';

export const paymentProviders: Readonly<Record<string, PaymentProvider>> = {
  payfast: payfastProvider,
  ozow: ozowProvider,
};

export function resolveProvider(id: string): PaymentProvider | null {
  return Object.prototype.hasOwnProperty.call(paymentProviders, id) ? paymentProviders[id] : null;
}

export type {
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
  VerifyFailureReason,
  VerifyNotificationResult,
} from './types';
