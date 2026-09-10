import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';
import { Card } from '@/components/nos/Card';
import { ShowSectionNav } from '@/components/show';
import { buildPageMetadata } from '@/lib/seo';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = buildPageMetadata({
  title: 'Workshops & Field Trips — National Show',
  description:
    'Book Sunset Cocktails and guided Field Trip outings at the South African National ' +
    'Orchid Show.',
  path: '/national-show/workshops',
});

const SESSIONS_NOTE =
  'Individual session times are still being finalised — the products below are the ' +
  'sellable Sunset Cocktails and Field Trip options. Per-session bookings are not yet ' +
  'available for purchase.';

// F9 (nos-design-system, M3): CategoryTicketsPage is owned by the sibling SAOC session and
// is not edited here — its `heroImage`/`eyebrow`/`heading`/`lede`/`note` props are this
// route's only levers, and it already re-skins through the inherited nos-theme tokens with
// zero changes to its own file. The `note` slot is a plain ReactNode, so it is restyled here
// as an NOS Card rather than the previous bare bordered box (design grammar: bare rules on a
// flat ground read generic and were rejected).
export default async function WorkshopsFieldTripsTicketsPage() {
  return (
    <>
      <CategoryTicketsPage
        category="workshop-field-trip"
        heroImage="/images/orchid-pink.jpg"
        eyebrow="2027 National Show"
        heading="Workshops & Field Trips"
        lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
        note={
          <Card role="note" className="font-sans text-[13px] leading-relaxed text-muted">
            {SESSIONS_NOTE}
          </Card>
        }
      />

      {/* F13 (M4) reconciliation — R3/L7 reachability. CategoryTicketsPage itself is
          owned by the sibling SAOC session and is not edited (see the comment above);
          this route's own page.tsx owns adding the section nav. */}
      <ShowSectionNav current="/national-show/workshops" />
    </>
  );
}
