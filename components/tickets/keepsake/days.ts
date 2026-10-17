// Day-cell rules of the Day Pass, shared by the card (client) and the hero mini ticket (server).

import { TICKET_COPY } from '@/lib/data/ticket-presentation';

import type { KeepsakeDay } from './types';

/** A day that cannot be chosen: sold out, no price yet, or the early bird has ended. */
export function isDayClosed(day: KeepsakeDay): boolean {
  return (
    day.state === 'soldOut' || day.state === 'pricePending' || day.state === 'earlyBirdSoldOut'
  );
}

/** The cell's second line: the state's words, or the real count, or nothing (R7). */
export function daySubline(day: KeepsakeDay): string | null {
  if (day.state === 'soldOut') return TICKET_COPY.soldOutStamp;
  if (day.state === 'pricePending') return TICKET_COPY.pricePending;
  if (day.state === 'earlyBirdSoldOut') return TICKET_COPY.earlyBirdEnded;
  if (day.remaining !== null && day.total !== null) return `${day.remaining} of ${day.total}`;
  return null;
}

export function firstSelectableDay(days: KeepsakeDay[] | null): string | null {
  return days?.find((d) => !isDayClosed(d))?.day ?? null;
}
