// =============================================================
// NOS — components/nos/ShowContactDetails.tsx
// Server Component. The show's address, as Lee-Ann gave it in her Contact document (24 Oct 2026).
// The telephone number was removed on 19 Nov 2026 and info@saoc.co.za added (Brad, meeting with
// Lee-Ann). Constants live in lib/show-contact.ts.
// =============================================================

import { SHOW_ADDRESS_LINES, SHOW_CONTACT_EMAIL } from '@/lib/show-contact';
import type { ShowVenue } from '@/types';

const HEADING_ADDRESS = 'Address of the show';
const HEADING_EMAIL = 'Email';
// The card's sentence-case label, shared with the gateway heading (nos-structure.css).
const LABEL_CLASS = 'nos-ct-label';
// The first address line is the place's name (CT-G1: Fraunces 400, 22px); the second is the address.
const PLACE_CLASS = 'nos-ct-place';
const BODY_CLASS = 'mt-3 font-sans text-[16px] leading-[1.55] text-ink/80';

const MAP_LINK_LABEL = 'Open in a map ↗';
const MAP_LINK_CLASS = 'inline-flex min-h-11 items-center';

// The venue lines as the shared VenueCard prints them, read from nationalShow.venue (Sanity). While
// the venue is missing the page falls back to Lee-Ann's two address lines (lib/show-contact.ts).
function venueLines(venue: ShowVenue): string[] {
  const cityLine = [venue.city, venue.postalCode].filter(Boolean).join(', ');
  return [...(venue.addressLines ?? []), cityLine, venue.province ?? ''].filter(Boolean);
}

export function ShowContactDetails({ venue }: { venue?: ShowVenue | null }) {
  const name = venue?.name ?? null;
  const lines = venue?.name ? venueLines(venue) : SHOW_ADDRESS_LINES.slice(1);
  return (
    <div data-show-contact-details="" className="mb-12 space-y-8">
      <section>
        <h2 className={LABEL_CLASS}>{HEADING_ADDRESS}</h2>
        <p className={PLACE_CLASS}>{name ?? SHOW_ADDRESS_LINES[0]}</p>
        <address className={`${BODY_CLASS} not-italic`}>
          {lines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
        {venue?.directionsNote ? <p className={BODY_CLASS}>{venue.directionsNote}</p> : null}
        {venue?.mapsUrl ? (
          <p className={BODY_CLASS}>
            <a
              href={venue.mapsUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={MAP_LINK_CLASS}
            >
              {MAP_LINK_LABEL}
            </a>
          </p>
        ) : null}
      </section>
      <section>
        <h2 className={LABEL_CLASS}>{HEADING_EMAIL}</h2>
        <p className={BODY_CLASS}>
          <a href={`mailto:${SHOW_CONTACT_EMAIL}`}>{SHOW_CONTACT_EMAIL}</a>
        </p>
      </section>
    </div>
  );
}
