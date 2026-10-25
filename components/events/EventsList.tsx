'use client';

import { useId, useState } from 'react';

import { groupByMonth, kindOptions, showEventControls } from '@/lib/events-list';

import type { ListedEvent } from './EventCard';
import { MonthGroup } from './MonthGroup';

const ALL = 'ALL';

const FOCUS_CLASSES =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-accent';
const LABEL_CLASSES = 'font-mono text-[11px] uppercase tracking-[0.18em] text-muted';
const CHIP_BASE = `inline-flex min-h-11 items-center rounded-full border px-4 font-sans text-[14px] transition-colors duration-150 ${FOCUS_CLASSES}`;
const CHIP_ON = 'border-primary bg-primary text-ivory';
const CHIP_OFF = 'border-rule bg-transparent text-primary hover:border-primary';

export interface EventsListProps {
  events: ListedEvent[];
}

export function EventsList({ events }: EventsListProps) {
  const [kind, setKind] = useState(ALL);
  const [month, setMonth] = useState(ALL);
  const monthId = useId();

  const controls = showEventControls(events.length);
  const kinds = kindOptions(events);
  const byKind = kind === ALL ? events : events.filter((event) => event.kind?.trim() === kind);
  const months = groupByMonth(byKind);
  // A kind change can leave the chosen month empty; fall back to every month rather than render nothing.
  const activeMonth = months.some((group) => group.key === month) ? month : ALL;
  const visible = activeMonth === ALL ? months : months.filter((group) => group.key === activeMonth);

  return (
    <>
      {controls ? (
        <div data-events-controls className="mb-10 flex flex-col gap-6 md:flex-row md:items-end">
          {kinds.length > 0 ? (
            <div role="group" aria-labelledby={`${monthId}-kind`} className="flex flex-col gap-2">
              <span id={`${monthId}-kind`} className={LABEL_CLASSES}>
                Kind
              </span>
              <div className="flex flex-wrap gap-2">
                {[ALL, ...kinds].map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={kind === option}
                    onClick={() => setKind(option)}
                    className={`${CHIP_BASE} ${kind === option ? CHIP_ON : CHIP_OFF}`}
                  >
                    {option === ALL ? 'All kinds' : option}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <label htmlFor={monthId} className={LABEL_CLASSES}>
              Month
            </label>
            <select
              id={monthId}
              value={activeMonth}
              onChange={(e) => setMonth(e.target.value)}
              className={`min-h-11 rounded-[2px] border border-rule bg-parchment px-3 font-sans text-[14px] text-ink ${FOCUS_CLASSES}`}
            >
              <option value={ALL}>All months</option>
              {months.map((group) => (
                <option key={group.key} value={group.key}>
                  {group.month}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}

      <div className="space-y-12">
        {visible.map((group) => (
          <MonthGroup key={group.key} month={group.month} events={group.events} />
        ))}
      </div>
    </>
  );
}
