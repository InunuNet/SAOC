import Link from 'next/link';

import { ConfirmationBadge } from '@/components/show';
import { EventRow } from '@/components/ui/EventRow';
import type { SocietyEvent } from '@/types';

const PREVIEW_COUNT = 5;

export interface SanityEvent {
  _id: string;
  title: string;
  slug: string | null;
  date: string;
  endDate: string | null;
  kind: string;
  description: string | null;
  venue: string | null;
  location: string | null;
  isFeatured: boolean | null;
  hostSociety: { _id: string; name: string; slug: string | null } | null;
}

export interface EventsStripProps {
  events?: SanityEvent[] | null;
}

export function EventsStrip({ events }: EventsStripProps) {
  const sanityMapped: SocietyEvent[] = (events ?? []).map((e, i) => ({
    id: i,
    date: e.date,
    endDate: e.endDate ?? undefined,
    title: e.title,
    host: e.hostSociety?.name ?? '',
    venue: e.venue ?? '',
    kind: e.kind,
    province: e.location ?? '',
    slug: e.slug ?? undefined,
  }));
  const preview = sanityMapped.slice(0, PREVIEW_COUNT);

  return (
    <section data-home-section="events" className="py-24 bg-parchment">
      <div className="saoc-container">
        {/* Section header: the label that used to be the eyebrow is the heading */}
        <div className="flex items-end justify-between gap-6 mb-8">
          <h2 className="font-serif font-light text-[clamp(32px,4vw,48px)] leading-[1.08] tracking-[-0.015em] text-primary">
            What&apos;s on
          </h2>
          <Link
            href="/events"
            className="inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary-800 transition-colors duration-150 shrink-0"
          >
            Full calendar →
          </Link>
        </div>

        {/* Event rows */}
        {preview.length > 0 ? (
          <div className="border-t border-rule">
            {preview.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="space-y-3 border-t border-rule pt-6">
            <p className="font-sans text-[16px] text-ink/70">No upcoming events scheduled.</p>
            <ConfirmationBadge status="pending" />
          </div>
        )}
      </div>
    </section>
  );
}
