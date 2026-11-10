import { formatShowDayLong } from '@/lib/show-day-format';

/**
 * ticket-email-samples — the order facts the per-ticket-type confirmation email prints, derived
 * from data the payment notification already holds. Shared by the real caller
 * (lib/tickets-notification.ts) and the sample generator, so the samples show exactly what a
 * live email would. Pure: no I/O.
 */

/** The notification handler only reaches the email after the gateway status mapped to 'paid'. */
export const PAID_STATUS_LABEL = 'Paid';

export interface OrderEmailFields {
  amountPaid: string;
  paymentStatus: string;
  /** Present only when the buyer chose a visit day; absent renders as "[To be confirmed]". */
  visitDate?: string;
}

/** `amount` is the order total in rand (the stored order price), `chosenDay` is YYYY-MM-DD. */
export function buildOrderEmailFields(amount: number, chosenDay: string | null): OrderEmailFields {
  return {
    amountPaid: `R${amount.toFixed(2)}`,
    paymentStatus: PAID_STATUS_LABEL,
    ...(chosenDay ? { visitDate: formatShowDayLong(chosenDay) } : {}),
  };
}
