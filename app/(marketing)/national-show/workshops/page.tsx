import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Workshops & Field Trips — National Show' };

const SESSIONS_NOTE =
  'Individual session times are still being finalised — the products below are the ' +
  'sellable Sunset Cocktails and Field Trip options. Per-session bookings are not yet ' +
  'available for purchase.';

export default async function WorkshopsFieldTripsTicketsPage() {
  return (
    <CategoryTicketsPage
      category="workshop-field-trip"
      heroImage="/images/orchid-pink.jpg"
      eyebrow="2027 National Show"
      heading="Workshops & Field Trips"
      lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
      note={
        <p
          className="border border-rule bg-bone px-6 py-4 font-sans text-[13px] leading-relaxed text-muted"
          role="note"
        >
          {SESSIONS_NOTE}
        </p>
      }
    />
  );
}
