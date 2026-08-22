'use client';

// F2 (ticketing-multi-line-item-cart-ui) — cart state, validation, and checkout submit
// for TicketPurchaseForm. Split out to keep TicketPurchaseForm.tsx under the project's
// 150-line limit.
import { useState } from 'react';

import type { CheckoutLineItemInput } from '@/app/api/tickets/checkout/route';
import {
  buildLineItemsFromCart,
  cartItemCount,
  computeCartTotal,
  CART_MAX_LINE_ITEMS,
  type CartAttendee,
} from '@/lib/cart';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { emptyAttendee, validateAttendees, validateChosenDays } from '@/components/tickets/cartValidation';
import type { AttendeeFieldErrors } from '@/components/tickets/CartAttendeeFields';
import type { DayPickerErrors } from '@/components/tickets/CartDayPicker';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

export type CheckoutStatus = 'idle' | 'submitting' | 'error';

export interface CheckoutRedirect {
  processUrl: string;
  fields: Record<string, string>;
  /** Provider-neutral, server-derived amount (route's own `amountFormatted`) — NEVER read
   *  off `fields`, whose keys are each provider's own wire format (PayFast's `amount`,
   *  Ozow's `Amount`). See CheckoutRedirectNotice's doc comment. */
  amount: string;
  providerId: string;
}

// F2 (ozow-payment-provider) — Ozow is the default: Brad's direction is that it is now the
// client's preferred gateway, not merely equal to PayFast. See components/tickets/ProviderChoice.
const DEFAULT_PROVIDER_ID = 'ozow';

export function useTicketCart(ticketTypes: TicketTypeCardData[]) {
  const typesOrder = ticketTypes.map((t) => t.slug);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [attendeesByType, setAttendeesByType] = useState<Record<string, CartAttendee[]>>({});
  const [attendeeErrors, setAttendeeErrors] = useState<AttendeeFieldErrors>({});
  const [chosenDayByType, setChosenDayByType] = useState<Record<string, string[]>>({});
  const [chosenDayErrors, setChosenDayErrors] = useState<DayPickerErrors>({});
  const [cartError, setCartError] = useState('');
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [redirect, setRedirect] = useState<CheckoutRedirect | null>(null);
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);
  // One key per form instance — see the original single-item form's note on why this is
  // never persisted across a PayFast Back navigation. Unchanged convention.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  function updateQuantity(slug: string, quantity: number) {
    setQuantities((prev) => ({ ...prev, [slug]: quantity }));
    setAttendeesByType((prev) => {
      const current = prev[slug] ?? [];
      if (quantity === current.length) return prev;
      if (quantity < current.length) return { ...prev, [slug]: current.slice(0, quantity) };
      const additional = Array.from({ length: quantity - current.length }, emptyAttendee);
      return { ...prev, [slug]: [...current, ...additional] };
    });

    const type = ticketTypes.find((t) => t.slug === slug);
    if (type?.requiresDaySelection) {
      setChosenDayByType((prev) => {
        const current = prev[slug] ?? [];
        if (quantity === current.length) return prev;
        if (quantity < current.length) return { ...prev, [slug]: current.slice(0, quantity) };
        const additional = Array.from({ length: quantity - current.length }, () => '');
        return { ...prev, [slug]: [...current, ...additional] };
      });
    }
  }

  function updateAttendeeField(slug: string, index: number, field: keyof CartAttendee, value: string) {
    setAttendeesByType((prev) => {
      const rows = prev[slug] ?? [];
      return { ...prev, [slug]: rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)) };
    });
  }

  function updateChosenDay(slug: string, index: number, value: string) {
    setChosenDayByType((prev) => {
      const rows = prev[slug] ?? [];
      return { ...prev, [slug]: rows.map((row, i) => (i === index ? value : row)) };
    });
  }

  async function submit() {
    if (status === 'submitting') return;

    setCartError('');
    const rowErrors = validateAttendees(ticketTypes, quantities, attendeesByType);
    setAttendeeErrors(rowErrors);
    const dayErrors = validateChosenDays(ticketTypes, quantities, chosenDayByType);
    setChosenDayErrors(dayErrors);

    const itemCount = cartItemCount(quantities);
    if (itemCount === 0) {
      setCartError('Please select at least one ticket.');
      return;
    }
    if (itemCount > CART_MAX_LINE_ITEMS) {
      setCartError(`Please select at most ${CART_MAX_LINE_ITEMS} tickets.`);
      return;
    }
    if (Object.keys(rowErrors).length > 0 || Object.keys(dayErrors).length > 0) return;

    let lineItems: CheckoutLineItemInput[];
    try {
      lineItems = buildLineItemsFromCart(quantities, attendeesByType, typesOrder, chosenDayByType);
    } catch {
      setCartError('Something is off with your ticket selection. Please review your entries and try again.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ showId: NATIONAL_SHOW_ID, lineItems, providerId }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        processUrl?: string;
        fields?: Record<string, string>;
        amount?: string;
        providerId?: string;
      };

      if (!res.ok || !data.processUrl || !data.fields || !data.amount) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Failed to start checkout. Please try again.');
        return;
      }

      setRedirect({
        processUrl: data.processUrl,
        fields: data.fields,
        amount: data.amount,
        providerId: data.providerId ?? providerId,
      });
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  return {
    quantities,
    attendeesByType,
    attendeeErrors,
    chosenDayByType,
    chosenDayErrors,
    cartError,
    status,
    errorMessage,
    redirect,
    providerId,
    setProviderId,
    estimatedTotal: computeCartTotal(quantities, ticketTypes),
    updateQuantity,
    updateAttendeeField,
    updateChosenDay,
    submit,
  };
}
