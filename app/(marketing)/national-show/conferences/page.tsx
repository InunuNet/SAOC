import type { Metadata } from 'next';

import { ConfirmationBadge } from '@/components/show';
import { CategoryTicketsPage } from '@/components/tickets';
import { buildPageMetadata } from '@/lib/seo';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = buildPageMetadata({
  title: 'Conferences — National Show',
  description:
    'Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint ' +
    'track at the South African National Orchid Show.',
  path: '/national-show/conferences',
});

// CategoryTicketsPage renders the NOS inner hero (nos-own-brand-chrome F2); `heroImage` is
// this route's only visual lever.
export default async function ConferencesTicketsPage() {
  return (
    <CategoryTicketsPage
      category="conference"
      heroImage="/images/orchid-violet.jpg"
      heading="Conferences"
      lede="Register for the SAOC Symposium, the WOSA Conference, or the combined SAOC/WOSA Joint track at the National Show."
      note={<ConfirmationBadge status="pending" />}
    />
  );
}
