import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';

// This page calls getSoldCountsByTicketType() (lib/data/tickets.ts), which uses the
// Firebase Admin SDK — and FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY are
// deliberately RUNTIME-only in apphosting.yaml (sold counts are live inventory; baking
// them into a prerendered build risks showing availability that isn't real and overselling
// the show — see contracts/contract-build-without-secrets.yaml). force-dynamic renders this
// page at request time on every hit instead of prerendering it, so the build never needs
// Admin credentials. This intentionally opts /tickets OUT of the F1 cms-loop's 60s ISR bound
// (contracts/cms-loop-f1-cdn-purge.yaml) — that bound still applies to every other
// CMS-backed page (revalidate-60-pages.golden.txt), which deliberately excludes this page.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Tickets' };

const FALLBACK_TITLE = 'Get Your Tickets';
const FALLBACK_INTRO = "Secure your seat at the SAOC National Show.";

export default async function TicketsPage() {
  return (
    <CategoryTicketsPage
      category="admission"
      heroImage="/images/orchid-purple.jpg"
      eyebrow="2027 National Show"
      heading={FALLBACK_TITLE}
      lede={FALLBACK_INTRO}
    />
  );
}
