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
import {
  blurEmailError,
  visibleFieldErrors,
  withBlurEmailError,
} from '@/components/tickets/blurValidation';
import { emptyAttendee, keepFlagged, validateAttendees } from '@/components/tickets/cartValidation';
import {
  attendeeRowKey,
  type AttendeeFieldErrors,
} from '@/components/tickets/CartAttendeeFields';
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

function pruneRowErrors(
  errors: AttendeeFieldErrors,
  slug: string,
  rowCount: number
): AttendeeFieldErrors {
  const kept: AttendeeFieldErrors = {};
  for (let index = 0; index < rowCount; index += 1) {
    const key = attendeeRowKey(slug, index);
    if (errors[key]) kept[key] = errors[key];
  }
  return kept;
}

export function useTicketCart(ticketType: TicketTypeCardData, init: CartInit) {
  const [quantity, setQuantityState] = useState(init.quantity);
  const [day, setDay] = useState<string | null>(init.day);
  const [attendees, setAttendees] = useState<CartAttendee[]>(() => resizeRows([], init.quantity));
  // Submit errors: these feed the form-level summary. Blur errors are inline only (an email left
  // invalid when the field loses focus) and never reach the summary.
  const [attendeeErrors, setAttendeeErrors] = useState<AttendeeFieldErrors>({});
  const [blurErrors, setBlurErrors] = useState<AttendeeFieldErrors>({});
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
    // A removed attendee's errors go with it, so a row added back later starts clean.
    setAttendeeErrors((prev) => pruneRowErrors(prev, ticketType.slug, clamped));
    setBlurErrors((prev) => pruneRowErrors(prev, ticketType.slug, clamped));
  }

  function updateAttendeeField(
    _slug: string,
    index: number,
    field: keyof CartAttendee,
    value: string
  ) {
    const next = attendees.map((row, i) => (i === index ? { ...row, [field]: value } : row));
    setAttendees(next);
    // After a failed submit, re-validate as the buyer corrects: a fixed field drops its error,
    // and a field that was not already flagged never gains one while typing.
    if (Object.keys(attendeeErrors).length > 0) {
      setAttendeeErrors(keepFlagged(attendeeErrors, validateCurrent(next)));
    }
    if (Object.keys(blurErrors).length > 0) {
      setBlurErrors(keepFlagged(blurErrors, validateCurrent(next)));
    }
  }

  // Blur on an attendee email flags a filled-in invalid address at once; an empty field is left for
  // the submit check, so tabbing through the form does not shout.
  function blurAttendeeEmail(_slug: string, index: number) {
    const row = attendees[index];
    if (!row) return;
    const key = attendeeRowKey(ticketType.slug, index);
    setBlurErrors((prev) => withBlurEmailError(prev, key, blurEmailError(row.attendeeEmail)));
  }

  function validateCurrent(rows: CartAttendee[]): AttendeeFieldErrors {
    return validateAttendees([ticketType], { [ticketType.slug]: quantity }, {
      [ticketType.slug]: rows,
    });
  }

  // Runs on every submit attempt, ahead of the day check, so one summary covers both.
  function validate(): boolean {
    const rowErrors = validateCurrent(attendees);
    setAttendeeErrors(rowErrors);
    setBlurErrors({});
    return Object.keys(rowErrors).length === 0;
  }

  // `registrationLineItems`: a flagged ticket type posts its registered people instead of the
  // attendee rows, which it does not show.
  async function submit(registrationLineItems?: CheckoutLineItemInput[]) {
    if (status === 'submitting' || quantity < MIN_QUANTITY) return;
    // A new attempt clears the last refusal's status, even if client validation stops it below.
    setErrorStatus(null);

    const quantities = { [ticketType.slug]: quantity };

    const chosenDays =
      ticketType.requiresDaySelection && day
        ? { [ticketType.slug]: Array<string>(quantity).fill(day) }
        : {};
    let lineItems: CheckoutLineItemInput[];
    try {
      lineItems =
        registrationLineItems ??
        buildLineItemsFromCart(
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
    // What the fields show: submit errors plus any blur-only email error.
    fieldErrors: visibleFieldErrors(blurErrors, attendeeErrors),
    status,
    errorMessage,
    errorStatus,
    redirect,
    estimatedTotal: computeCartTotal({ [ticketType.slug]: quantity }, [ticketType]),
    setQuantity,
    setDay,
    updateAttendeeField,
    blurAttendeeEmail,
    validate,
    submit,
  };
}
