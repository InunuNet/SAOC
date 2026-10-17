import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { PresenterSection } from '@/components/nos/PresenterSection';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { TICKET_COPY } from '@/lib/data/ticket-presentation';
import { loadShowFacts } from '@/lib/data/show-facts';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { loadTicketCardViewModel } from '@/lib/view-models/load-ticket-card';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F12 (national-show-ia-alignment, M4) — created route.
//
// SAOC is orchids IN CULTIVATION (CLAUDE.md § "Critical scope boundary"). Wild orchid
// identification, habitat and conservation belong to WOSA, a separate organisation with
// its own site — this page states what the conference is and links OUT; it generates no
// wild-orchid content of its own. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §4
// and goldens/m3/wosa-content-boundary.golden.md.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// The WOSA link-out below is static and independent of the ShowPage, so it is passed as
// `afterProse` and rendered in the published branch only — an absent page shows the
// disclosure alone. See goldens/m4/never-404-fallback.golden.md.
//
// F6 (conference-workshop-tickets, M4) — additive data-fetch; same note as
// symposium/page.tsx's own identical comment (golden §3). nos-presenter-cards renders the
// presenters under the hero (none today, so the page is unchanged). `dynamic = 'force-dynamic'` added for the same Firebase-Admin-reachability
// reason given there.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'WOSA Conference — National Orchid Show',
  image: nosOgImage('WOSA Conference — National Orchid Show'),
  description: 'The WOSA Conference, held alongside the National Show, and what it is for.',
  path: '/national-show/wosa-conference',
});

export default async function WosaConferencePage() {
  const [result, facts] = await Promise.all([
    loadShowPageOrFallback('07-wosa-conference', {
      label: 'WOSA Conference',
      purpose:
        'What the WOSA Conference is and who it is for, with a link out to WOSA for wild-orchid content.',
    }),
    loadShowFacts(),
  ]);

  // F6 (conference-workshop-tickets, M4) — additive; see symposium/page.tsx's identical
  // note and the file-header comment above.
  //
  // Codex finding (2026-10-07, relayed by team-lead) — same fix as symposium/page.tsx's
  // identical note: these loaders can reject on a real Sanity/Firestore backend failure;
  // neither result may turn this public content page into a 500.
  let presenters: Awaited<ReturnType<typeof loadPresenterViewModels>> = [];
  try {
    presenters = await loadPresenterViewModels('wosa-conference');
  } catch (error) {
    console.error('[national-show/wosa-conference] loadPresenterViewModels failed:', error);
  }
  let ticketCard: Awaited<ReturnType<typeof loadTicketCardViewModel>> | null = null;
  try {
    ticketCard = await loadTicketCardViewModel('wosa-conference');
  } catch (error) {
    console.error('[national-show/wosa-conference] loadTicketCardViewModel failed:', error);
  }
  void ticketCard;

  return (
    <>
      <div className="contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]">
        <ShowContentState
          result={result}
          route="/national-show/wosa-conference"
          layout="prose"
          holding={{ facts, keepAfterProse: true }}
          afterProse={
            <>
              <div className="mb-8">
                <Button as={Link} href="/national-show/conferences#ticket-wosa">
                  {TICKET_COPY.buy}
                </Button>
              </div>
              {/* SAOC attributes and links out; it never authors conservation content in its
                  own voice — the same standing rule the /about page's WOSA credit follows. */}
              <p className="max-w-[60ch] border-t border-rule pt-6 font-sans text-[15px] leading-relaxed text-ink/70">
                For wild orchid identification, habitat and conservation, visit our partner
                organisation{' '}
                <a
                  href="https://wildorchids.co.za"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-link"
                >
                  Wild Orchids of Southern Africa (WOSA)
                </a>
                .
              </p>
            </>
          }
        />
      </div>

      <PresenterSection eyebrow="WOSA Conference" presenters={presenters} />
      <NosShowIndex current="/national-show/wosa-conference" />
    </>
  );
}
