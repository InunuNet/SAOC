import type { VendorStandOrderStatus } from '@/types/index';

// F32 (vendor-gated-registration-flow, M3) — read-only display labels only. This is NOT the
// office-use `paymentReceived` (F7/EFT) signal, so an operator never conflates "gateway-paid"
// with "office-confirmed manually". Shared by the review table and the full-registration view.
export const STAND_PAYMENT_LABELS: Record<VendorStandOrderStatus | 'not-started', string> = {
  'not-started': 'Not started',
  pending: 'Pending',
  paid: 'Paid',
  failed: 'Failed',
  cancelled: 'Failed',
};
