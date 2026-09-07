import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Conferences — National Show' };

// F9 (nos-design-system, M3): CategoryTicketsPage is owned by the sibling SAOC session and
// is not edited here — `heroImage` is this route's only visual lever, and the component
// already re-skins through the inherited nos-theme tokens with zero changes to its own file.
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
