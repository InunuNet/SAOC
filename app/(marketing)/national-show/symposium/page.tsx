import type { Metadata } from 'next';

import { PresenterJumpLink } from '@/components/nos/PresenterSection';
import { PresenterSection } from '@/components/nos/PresenterSection';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { loadTicketCardViewModel } from '@/lib/view-models/load-ticket-card';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';

// F12 (national-show-ia-alignment, M4) — created route. One sentence of real source
// (the `theme` section) exists; everything else is placeholder under an R11 disclosure
// until the Council confirms the symposium's date and venue.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// See goldens/m4/never-404-fallback.golden.md.
//
// F6 (conference-workshop-tickets, M4) — additive data-fetch (golden §3): the two
// view-model loaders below are computed for F7's design handoff (the NOS design peer
// session). nos-presenter-cards renders the presenters under the hero; the ticket card is
// still reserved and unrendered.
// `dynamic = 'force-dynamic'` is added because loadTicketCardViewModel() reaches Firebase
// Admin (getPoolRemaining -> getSoldCountsByTicketType) — same rule this codebase already
// applies everywhere else that call chain is reachable (see app/(marketing)/national-show/
// workshops/page.tsx's own identical comment on CategoryTicketsPage).
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'SAOC Symposium — National Orchid Show',
  image: nosOgImage('SAOC Symposium — National Orchid Show'),
  description: 'What the SAOC Symposium is, and who it is for.',
  path: '/national-show/symposium',
});

export default async function SymposiumPage() {
  const result = await loadShowPageOrFallback('06-saoc-symposium', {
    label: 'SAOC Symposium',
    purpose: 'The SAOC Symposium — what it is, its theme, and who it is for.',
  });

  // F6 (conference-workshop-tickets, M4) — additive: see the file-header comment above.
  //
  // Codex finding (2026-10-07, relayed by team-lead): these loaders reach Sanity/Firestore
  // (getPoolRemaining -> getSoldCountsByTicketType) and can reject on a real backend
  // failure. Neither result may turn this public content page into a 500, which previously
  // degraded gracefully via ShowContentState alone. Caught here at the call
  // site, same `console.error('[module/path] ...', error)` pattern already used elsewhere
  // in this route tree (e.g. vendors/register/page.tsx's isVendorRegistrationSessionUsable).
  let presenters: Awaited<ReturnType<typeof loadPresenterViewModels>> = [];
  try {
    presenters = await loadPresenterViewModels('saoc-symposium');
  } catch (error) {
    console.error('[national-show/symposium] loadPresenterViewModels failed:', error);
  }
  let ticketCard: Awaited<ReturnType<typeof loadTicketCardViewModel>> | null = null;
  try {
    ticketCard = await loadTicketCardViewModel('saoc-symposium');
  } catch (error) {
    console.error('[national-show/symposium] loadTicketCardViewModel failed:', error);
  }
  void ticketCard;

  return (
    <>
      <div className="contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]">
        <ShowContentState
          result={result}
          route="/national-show/symposium"
          layout="prose"
          afterHero={<PresenterJumpLink presenters={presenters} />}
        />
      </div>

      <PresenterSection eyebrow="Symposium" presenters={presenters} />
    </>
  );
}
