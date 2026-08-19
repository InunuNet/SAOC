/**
 * The single provider-selection point.
 *
 * One const, deliberately: no registry, no map, no dynamic import, no PAYMENT_PROVIDER env
 * switch. Packaging is explicitly deferred — swapping gateways means changing this line and
 * nothing else, and anything more elaborate would be scaffolding for a second adapter that does
 * not exist yet.
 */
import { payfastProvider } from './payfast';

import type { PaymentProvider } from './types';

export const paymentProvider: PaymentProvider = payfastProvider;

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
