import type { Metadata } from 'next';

import { CategoryTicketsPage } from '@/components/tickets';
import { Card } from '@/components/nos/Card';
import { buildPageMetadata } from '@/lib/seo';
import { loadWorkshopSessionViewModels } from '@/lib/view-models/load-workshop-sessions';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// See app/(marketing)/tickets/page.tsx for why this stays force-dynamic — the shared
// CategoryTicketsPage component calls getSoldCountsByTicketType() (Firebase Admin SDK,
// runtime-only credentials).
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = buildPageMetadata({
  title: 'Workshops & Field Trips — National Show',
  image: nosOgImage('Workshops & Field Trips — National Show'),
  description:
    'Book Sunset Cocktails and guided Field Trip outings at the South African National ' +
    'Orchid Show.',
  path: '/national-show/workshops',
});

const SESSIONS_NOTE =
  'Individual session times are still being finalised — the products below are the ' +
  'sellable Sunset Cocktails and Field Trip options. Per-session bookings are not yet ' +
  'available for purchase.';

// CategoryTicketsPage renders the NOS inner hero (nos-own-brand-chrome F2); its
// `heroImage`/`heading`/`lede`/`note` props are this route's levers. The `note` slot is a plain ReactNode, so it is restyled here
// as an NOS Card rather than the previous bare bordered box (design grammar: bare rules on a
// flat ground read generic and were rejected).
export default async function WorkshopsFieldTripsTicketsPage() {
  // F6 (conference-workshop-tickets, M4) — additive, inert: computed and reserved for
  // F7's design handoff, which renders real per-session cards. Zero JSX change — the
  // CategoryTicketsPage render below (owned by the sibling SAOC session, per its own
  // header comment above) is untouched.
  //
  // Codex finding (2026-10-07, relayed by team-lead) — same fix as symposium/page.tsx's
  // identical note: loadWorkshopSessionViewModels() resolves each session's ticketCard
  // through loadTicketCardViewModel() (lib/view-models/load-workshop-sessions.ts), which
  // reaches Sanity/Firestore and can reject on a real backend failure; its unrendered
  // result must never turn this public content page into a 500.
  let workshopSessions: Awaited<ReturnType<typeof loadWorkshopSessionViewModels>> = [];
  try {
    workshopSessions = await loadWorkshopSessionViewModels();
  } catch (error) {
    console.error('[national-show/workshops] loadWorkshopSessionViewModels failed:', error);
  }
  void workshopSessions;

  return (
    <>
      <CategoryTicketsPage
        category="workshop-field-trip"
        route="/national-show/workshops"
        heading="Workshops & Field Trips"
        lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
        note={
          <Card role="note" className="font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-muted">
            {SESSIONS_NOTE}
          </Card>
        }
      />
      <NosShowIndex current="/national-show/workshops" currentTone="ink" />
    </>
  );
}
