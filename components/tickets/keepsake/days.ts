// Day-cell rules of the Day Pass card, and the count display the other cards share.

import { TICKET_COPY } from '@/lib/data/ticket-presentation';

import type { CountDisplay, KeepsakeDay } from './types';

/** A day that cannot be chosen: sold out, no price yet, or the early bird has ended. */
export function isDayClosed(day: KeepsakeDay): boolean {
  return (
    day.state === 'soldOut' || day.state === 'pricePending' || day.state === 'earlyBirdSoldOut'
  );
}

/** What a count shows: its figure, nothing (withheld in public), or the figure marked. */
export function countDisplay(
  provisional: boolean | undefined,
  showProvisional: boolean
): CountDisplay {
  if (!provisional) return 'real';
  return showProvisional ? 'placeholder' : 'withhold';
}

/** The cell's second line: the state's words, or the real count, or nothing (R7). */
export function daySubline(day: KeepsakeDay, counts: CountDisplay = 'real'): string | null {
  if (day.state === 'soldOut') return TICKET_COPY.soldOutStamp;
  if (day.state === 'pricePending') return TICKET_COPY.pricePending;
  if (day.state === 'earlyBirdSoldOut') return TICKET_COPY.earlyBirdEnded;
  if (counts === 'withhold') return null;
  if (day.remaining !== null && day.total !== null) return `${day.remaining} of ${day.total}`;
  return null;
}
