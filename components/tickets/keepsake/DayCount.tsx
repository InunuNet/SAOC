// The Day Pass day option's count cell, shared by the hub card's picker and the checkout form
// (rLC, r45 P3): one definition of the "N of T" / "N left" pair, the state words and the
// "Few left" line, so the two pickers cannot drift. The hub's CSS decides which line shows.

import { TICKET_COPY } from '@/lib/data/ticket-presentation';

import { countDisplay, daySubline } from './days';
import type { KeepsakeDay } from './types';

interface DayCountProps {
  d: KeepsakeDay;
  showProvisional: boolean;
  /** Set by the checkout so the day's radio can point at its count; the hub leaves it off. */
  id?: string;
}

/** True when the option has a count line to render (it may be withheld in public, R7). */
export function hasDayCountLine(d: KeepsakeDay, showProvisional: boolean): boolean {
  return daySubline(d, countDisplay(d.provisional, showProvisional)) !== null;
}

export function DayCount({ d, showProvisional, id }: DayCountProps) {
  const counts = countDisplay(d.provisional, showProvisional);
  const sub = daySubline(d, counts);
  const placeholder = counts === 'placeholder' ? 'true' : undefined;
  return (
    <>
      {sub && d.remaining !== null && sub === `${d.remaining} of ${d.total}` ? (
        <span id={id} data-placeholder={placeholder}>
          <span className="nk-of">{sub}</span>
          <span className="nk-left">{`${d.remaining} left`}</span>
        </span>
      ) : sub ? (
        <span id={id} data-placeholder={placeholder}>
          {sub}
        </span>
      ) : null}
      {d.state === 'low' ? <span className="nk-sub">{TICKET_COPY.fewLeft}</span> : null}
    </>
  );
}

/** The "Not yet confirmed" note under a picker whose counts come from provisional totals. */
export function DayCountNote({
  days,
  showProvisional,
}: {
  days: KeepsakeDay[];
  showProvisional: boolean;
}) {
  return showProvisional && days.some((d) => d.provisional && daySubline(d, 'placeholder')) ? (
    <p className="nk-unconfirmed">{TICKET_COPY.notYetConfirmed}</p>
  ) : null;
}
