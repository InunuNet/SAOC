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
  expandAttendeesByDayToLineItems,
  flattenAttendeesByDay,
  updateAttendeeFieldByFlatIndex,
  updateAttendeesByDay,
  CART_MAX_LINE_ITEMS,
  type AttendeesByDay,
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

export function useTicketCart(ticketTypes: TicketTypeCardData[], showDays: string[]) {
  const typesOrder = ticketTypes.map((t) => t.slug);
  const useDayQuantityPicker =
    ticketTypes.length === 1 && ticketTypes[0].requiresDaySelection === true;
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [attendeesByTypeState, setAttendeesByType] = useState<Record<string, CartAttendee[]>>({});
  const [attendeeErrors, setAttendeeErrors] = useState<AttendeeFieldErrors>({});
  const [chosenDayByType, setChosenDayByType] = useState<Record<string, string[]>>({});
  const [chosenDayErrors, setChosenDayErrors] = useState<DayPickerErrors>({});
  // F3 (ticketing-flow-redesign, second correction) — per-day ATTENDEE ROW state for the
  // Day Visitor single-type screen. Source of truth; quantitiesByDay below is a derived
  // read of each day's own row-array length, so it cannot drift from attendeesByDay by
  // construction. Coexists with, and is independent of, chosenDayByType above (F5's
  // per-unit day-assignment model, still used by CartDayPicker's multi-type cart path).
  const [attendeesByDay, setAttendeesByDay] = useState<AttendeesByDay>({});
  const quantitiesByDay = Object.fromEntries(
    showDays.map((day) => [day, attendeesByDay[day]?.length ?? 0])
  );
  const attendeesByType = useDayQuantityPicker
    ? { ...attendeesByTypeState, [ticketTypes[0].slug]: flattenAttendeesByDay(attendeesByDay, showDays) }
    : attendeesByTypeState;
  const [cartError, setCartError] = useState('');
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [redirect, setRedirect] = useState<CheckoutRedirect | null>(null);
  // One key per form instance — see the original single-item form's note on why this is
  // never persisted across a PayFast Back navigation. Unchanged convention.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Shared by updateQuantity (per-unit flow) and updateDayQuantity (F3's per-day flow) —
  // resizes a type's attendee-row array to match its new total quantity.
  function syncAttendeeRows(slug: string, quantity: number) {
    setAttendeesByType((prev) => {
      const current = prev[slug] ?? [];
      if (quantity === current.length) return prev;
      if (quantity < current.length) return { ...prev, [slug]: current.slice(0, quantity) };
      const additional = Array.from({ length: quantity - current.length }, emptyAttendee);
      return { ...prev, [slug]: [...current, ...additional] };
    });
  }

  function updateQuantity(slug: string, quantity: number) {
    setCartError('');
    setQuantities((prev) => ({ ...prev, [slug]: quantity }));
    syncAttendeeRows(slug, quantity);

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

  // F3 (ticketing-flow-redesign, second correction) — Day Visitor's per-day quantity
  // picker. Resizes ONLY that day's own attendeesByDay row array; every other day's rows
  // are untouched, so editing one day's stepper can never shift which rows belong to
  // another day regardless of edit order. Deliberately does NOT touch chosenDayByType
  // (unlike updateQuantity above): this screen replaces the per-unit day-assignment model
  // with attendeesByDay entirely, and populating chosenDayByType here would make
  // validateChosenDays demand day selections for a UI (CartDayPicker) that isn't rendered
  // on this screen. `quantities[slug]` is kept in sync with the day-quantity total so
  // estimatedTotal/cartItemCount keep working unchanged for this type.
  function updateDayQuantity(day: string, quantity: number) {
    const currentLength = attendeesByDay[day]?.length ?? 0;
    if (quantity === currentLength) return;
    setCartError('');
    setAttendeesByDay((prev) => updateAttendeesByDay(prev, day, quantity, emptyAttendee));

    const slug = ticketTypes.length === 1 ? ticketTypes[0].slug : undefined;
    if (!slug) return;
    const delta = quantity - currentLength;
    setQuantities((prev) => ({ ...prev, [slug]: (prev[slug] ?? 0) + delta }));
  }

  function updateAttendeeField(slug: string, index: number, field: keyof CartAttendee, value: string) {
    if (useDayQuantityPicker && slug === ticketTypes[0].slug) {
      setAttendeesByDay((prev) => updateAttendeeFieldByFlatIndex(prev, showDays, index, field, value));
      return;
    }
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
      if (useDayQuantityPicker) {
        const slug = ticketTypes[0].slug;
        lineItems = expandAttendeesByDayToLineItems({
          ticketType: slug,
          attendeesByDay,
          showDays,
        });
      } else {
        lineItems = buildLineItemsFromCart(quantities, attendeesByType, typesOrder, chosenDayByType);
      }
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
    quantities,
    attendeesByType,
    attendeeErrors,
    chosenDayByType,
    chosenDayErrors,
    quantitiesByDay,
    cartError,
    status,
    errorMessage,
    redirect,
    estimatedTotal: computeCartTotal(quantities, ticketTypes),
    updateQuantity,
    updateAttendeeField,
    updateChosenDay,
    updateDayQuantity,
    submit,
  };
}
