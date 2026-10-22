'use client';

// Cart state, validation and checkout submit for TicketPurchaseForm: one ticket type, one
// quantity, and (for a day product) one chosen day shared by every ticket in the order.
import { useState } from 'react';

import type { CheckoutLineItemInput } from '@/app/api/tickets/checkout/route';
import {
  buildLineItemsFromCart,
  computeCartTotal,
  CART_MAX_LINE_ITEMS,
  type CartAttendee,
} from '@/lib/cart';
import { NATIONAL_SHOW_ID } from '@/lib/tickets-constants';
import { emptyAttendee, validateAttendees } from '@/components/tickets/cartValidation';
import type { AttendeeFieldErrors } from '@/components/tickets/CartAttendeeFields';
import type { TicketTypeCardData } from '@/components/tickets/TicketTypeCard';

export type CheckoutStatus = 'idle' | 'submitting' | 'error';

export interface CheckoutRedirect {
  processUrl: string;
  fields: Record<string, string>;
  // Provider-neutral, server-derived amount (the route's own `amountFormatted`), never read off
  // `fields`, whose keys are each provider's own wire format (PayFast's `amount`, Ozow's
  // `Amount`). See CheckoutRedirectNotice's doc comment.
  amount: string;
  providerId: string;
}

// What the screen opens with: a hub card's "Buy ticket" link carries a quantity and a day.
export interface CartInit {
  quantity: number;
  day: string | null;
}

const MIN_QUANTITY = 1;

function resizeRows(rows: CartAttendee[], quantity: number): CartAttendee[] {
  if (quantity <= rows.length) return rows.slice(0, quantity);
  return [...rows, ...Array.from({ length: quantity - rows.length }, emptyAttendee)];
}

export function useTicketCart(ticketType: TicketTypeCardData, init: CartInit) {
  const [quantity, setQuantityState] = useState(init.quantity);
  const [day, setDay] = useState<string | null>(init.day);
  const [attendees, setAttendees] = useState<CartAttendee[]>(() => resizeRows([], init.quantity));
  const [attendeeErrors, setAttendeeErrors] = useState<AttendeeFieldErrors>({});
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  // The checkout reply's HTTP status when it refused the order; null for validation, network and success.
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [redirect, setRedirect] = useState<CheckoutRedirect | null>(null);
  // One key per form instance, never persisted across a PayFast Back navigation.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Typing can reach 0 (the CTA then shows its hint); the stepper buttons stay within 1..max.
  function setQuantity(next: number) {
    const clamped = Math.min(CART_MAX_LINE_ITEMS, Math.max(0, Math.trunc(next)));
    setQuantityState(clamped);
    setAttendees((prev) => resizeRows(prev, clamped));
  }

  function updateAttendeeField(
    _slug: string,
    index: number,
    field: keyof CartAttendee,
    value: string
  ) {
    setAttendees((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function submit() {
    if (status === 'submitting' || quantity < MIN_QUANTITY) return;

    const quantities = { [ticketType.slug]: quantity };
    const rowErrors = validateAttendees([ticketType], quantities, {
      [ticketType.slug]: attendees,
    });
    setAttendeeErrors(rowErrors);
    if (Object.keys(rowErrors).length > 0) return;

    const chosenDays =
      ticketType.requiresDaySelection && day
        ? { [ticketType.slug]: Array<string>(quantity).fill(day) }
        : {};
    let lineItems: CheckoutLineItemInput[];
    try {
      lineItems = buildLineItemsFromCart(
        quantities,
        { [ticketType.slug]: attendees },
        [ticketType.slug],
        chosenDays
      );
    } catch {
      setStatus('error');
      setErrorMessage(
        'Something is off with your ticket selection. Please review your entries and try again.'
      );
      return;
    }

    setStatus('submitting');
    setErrorMessage('');
    setErrorStatus(null);

    try {
      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ showId: NATIONAL_SHOW_ID, lineItems }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        processUrl?: string;
        fields?: Record<string, string>;
        amount?: string;
        providerId?: string;
      };

      if (!res.ok || !data.processUrl || !data.fields || !data.amount || !data.providerId) {
        setStatus('error');
        setErrorStatus(res.ok ? null : res.status);
        setErrorMessage(data.error ?? 'Failed to start checkout. Please try again.');
        return;
      }

      setRedirect({
        processUrl: data.processUrl,
        fields: data.fields,
        amount: data.amount,
        providerId: data.providerId,
      });
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please check your connection and try again.');
    }
  }

  return {
    quantity,
    day,
    attendees,
    attendeeErrors,
    status,
    errorMessage,
    errorStatus,
    redirect,
    estimatedTotal: computeCartTotal({ [ticketType.slug]: quantity }, [ticketType]),
    setQuantity,
    setDay,
    updateAttendeeField,
    submit,
  };
}
