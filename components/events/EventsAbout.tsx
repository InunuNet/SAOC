import { PortableText } from '@portabletext/react';
import type { PortableTextBlock } from '@portabletext/react';
import Link from 'next/link';

import { ConfirmationBadge } from '@/components/show';

/**
 * COPY GAP (EV-3): the calendar-subscribe button has no approved label, so it does not render.
 * Set this to the approved wording to ship it. See docs/events-redesign.md.
 */
export const EVENTS_CALENDAR_SUBSCRIBE_LABEL: string | null = null;

const OUTLINE_BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-primary px-[22px] py-[12px] font-sans text-[14px] font-medium text-primary transition-colors duration-150 hover:bg-primary hover:text-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[3px] focus-visible:outline-accent';

export interface EventsAboutProps {
  intro?: PortableTextBlock[] | null;
  /** Public build: an empty write-up renders nothing. Preview: it shows the awaiting-copy marker. */
  withhold: boolean;
}

export function EventsAbout({ intro, withhold }: EventsAboutProps) {
  const hasIntro = Boolean(intro && intro.length > 0);

  return (
    <section data-events-about className="saoc-container py-16">
      <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
        {hasIntro ? (
          <div className="max-w-[62ch] space-y-4 font-sans text-[16px] leading-[1.6] text-ink/85">
            <PortableText value={intro ?? []} />
          </div>
        ) : withhold ? null : (
          <div className="max-w-[62ch]">
            <ConfirmationBadge status="pending" />
          </div>
        )}
        <div className="flex flex-col items-start gap-3 md:col-start-2">
          <Link href="/societies" className={OUTLINE_BUTTON}>
            Find your society
          </Link>
          {EVENTS_CALENDAR_SUBSCRIBE_LABEL !== null ? (
            <a href="/api/events.ics" className={OUTLINE_BUTTON}>
              {EVENTS_CALENDAR_SUBSCRIBE_LABEL}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
