import Link from 'next/link';

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
  const preview: SocietyEvent[] = (events ?? []).slice(0, PREVIEW_COUNT).map((e, i) => ({
    id: i,
    date: e.date,
    endDate: e.endDate ?? undefined,
    title: e.title,
    host: e.hostSociety?.name ?? '',
    venue: e.venue ?? '',
    kind: e.kind,
    province: e.location ?? '',
  }));

  return (
    <section className="py-24 px-8 md:px-16 bg-parchment">
      <div className="max-w-[1280px] mx-auto">
        {/* Section header */}
        <div className="flex items-end justify-between mb-10 border-b border-rule pb-6">
          <h2 className="font-serif text-[32px] font-medium text-primary">What&apos;s on</h2>
          <Link
            href="/events"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent hover:text-primary transition-colors duration-150"
          >
            Full calendar →
          </Link>
        </div>

        {/* Event rows */}
        <div>
          {preview.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      </div>
    </section>
  );
}
