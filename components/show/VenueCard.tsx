// =============================================================
// SAOC — components/show/VenueCard.tsx
// Server Component — every venue detail a visitor needs, read entirely from the
// nationalShow.venue object in Sanity.
//
// THE VENUE-CHANGE TEST lives here: this file contains no venue name, street, city,
// coordinate or map URL — not even as a fallback. Changing the venue is a Studio edit.
// Reused verbatim by /contact so the two can never drift apart.
// See contracts/golden/show-visitor-info/venue-single-source.golden.md.
// =============================================================

import Image from 'next/image';

import { urlFor } from '@/sanity/lib/image';
import type { ConfirmationStatus, ShowVenue } from '@/types';

import { ConfirmationBadge } from './ConfirmationBadge';

export interface VenueCardProps {
  venue?: ShowVenue | null;
  heading?: string;
  status?: ConfirmationStatus | string | null;
  pendingLabel?: string | null;
  researchLabel?: string | null;
}

export function VenueCard({
  venue,
  heading = 'The venue',
  status,
  pendingLabel,
  researchLabel,
}: VenueCardProps) {
  if (!venue?.name) return null;

  const addressLines = venue.addressLines ?? [];
  const cityLine = [venue.city, venue.postalCode].filter(Boolean).join(', ');

  return (
    <section className="border border-rule bg-parchment p-6">
      <h3 className="font-serif text-[22px] font-medium text-ink">{heading}</h3>
      <ConfirmationBadge
        status={status}
        pendingLabel={pendingLabel}
        researchLabel={researchLabel}
      />

      <address className="mt-4 not-italic font-sans text-[15px] leading-relaxed text-ink/80">
        <span className="block font-serif text-[18px] text-ink">{venue.name}</span>
        {addressLines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
        {cityLine ? <span className="block">{cityLine}</span> : null}
        {venue.province ? <span className="block">{venue.province}</span> : null}
        {venue.phone ? (
          <a
            href={`tel:${venue.phone.replace(/\s+/g, '')}`}
            className="mt-2 inline-block underline underline-offset-2 hover:text-accent"
          >
            {venue.phone}
          </a>
        ) : null}
      </address>

      {venue.mapImage ? (
        <div className="relative mt-5 aspect-[16/9] w-full overflow-hidden border border-rule">
          <Image
            src={urlFor(venue.mapImage).width(1200).url()}
            alt={venue.mapImageAlt ?? `Map showing ${venue.name}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
        </div>
      ) : null}

      {venue.directionsNote ? (
        <p className="mt-5 font-sans text-[15px] leading-relaxed text-ink/70">
          {venue.directionsNote}
        </p>
      ) : null}

      {venue.mapsUrl ? (
        <a
          href={venue.mapsUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-5 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-ink underline underline-offset-4 hover:text-accent"
        >
          Open in a map ↗
        </a>
      ) : null}
    </section>
  );
}
