import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Conferences — National Show' };

export default async function ConferencesTicketsPage() {
  return (
    <CategoryTicketsPage
      category="conference"
      heroImage="/images/orchid-violet.jpg"
      eyebrow="2027 National Show"
      heading="Conferences"
      lede="Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show."
    />
  );
}
