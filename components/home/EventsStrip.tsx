import Link from 'next/link';

import { EventRow } from '@/components/ui/EventRow';
import { events as staticEvents } from '@/lib/data';
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
  }));
  const preview = (sanityMapped.length > 0 ? sanityMapped : staticEvents).slice(0, PREVIEW_COUNT);

  return (
    <section className="py-24 px-8 md:px-16 bg-parchment">
      <div className="max-w-[1280px] mx-auto">
        {/* Section header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="mb-4"><span className="eyebrow">What&apos;s on</span></div>
            <h2 className="font-serif text-[clamp(32px,4vw,48px)] font-medium leading-[1.08] tracking-[-0.01em] text-primary">
              Upcoming society shows
            </h2>
          </div>
          <Link
            href="/events"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-primary transition-colors duration-150 mt-1 shrink-0"
          >
            Full calendar →
          </Link>
        </div>

        {/* Event rows */}
        <div className="border-t border-rule">
          {preview.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
