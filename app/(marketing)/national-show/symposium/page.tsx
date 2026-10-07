import type { Metadata } from 'next';

import { ShowSectionNav } from '@/components/show';
import { ShowContentState } from '@/components/show/nos/ShowContentState';
import { loadShowPageOrFallback } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { loadTicketCardViewModel } from '@/lib/view-models/load-ticket-card';

// F12 (national-show-ia-alignment, M4) — created route. One sentence of real source
// (the `theme` section) exists; everything else is placeholder under an R11 disclosure
// until the Council confirms the symposium's date and venue.
//
// F24 (M4) — replaces the hard 404 guard with loadShowPageOrFallback()/
// <ShowContentState>, so an absent document renders a disclosed shell instead of a 404.
// See goldens/m4/never-404-fallback.golden.md.
//
// F6 (conference-workshop-tickets, M4) — additive, inert data-fetch only (golden §3): the
// two view-model loaders below are computed and reserved for F7's design handoff (the NOS
// design peer session), which renders the real presenter/counter cards. Zero JSX change
// here — the render tree below is byte-for-byte unchanged from before this feature.
// `dynamic = 'force-dynamic'` is added because loadTicketCardViewModel() reaches Firebase
// Admin (getPoolRemaining -> getSoldCountsByTicketType) — same rule this codebase already
// applies everywhere else that call chain is reachable (see app/(marketing)/national-show/
// workshops/page.tsx's own identical comment on CategoryTicketsPage).
export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = buildPageMetadata({
  title: 'SAOC Symposium — National Orchid Show',
  description: 'What the SAOC Symposium is, and who it is for.',
  path: '/national-show/symposium',
});

export default async function SymposiumPage() {
  const result = await loadShowPageOrFallback('06-saoc-symposium', {
    label: 'SAOC Symposium',
    purpose: 'The SAOC Symposium — what it is, its theme, and who it is for.',
  });

  // F6 (conference-workshop-tickets, M4) — additive, inert: computed and reserved for
  // F7's design handoff. See the file-header comment above.
  //
  // Codex finding (2026-10-07, relayed by team-lead): these loaders reach Sanity/Firestore
  // (getPoolRemaining -> getSoldCountsByTicketType) and can reject on a real backend
  // failure. Their result isn't even rendered yet (F7 is what renders it) — an inert,
  // unrendered data-fetch must never turn this public content page into a 500, which
  // previously degraded gracefully via ShowContentState alone. Caught here at the call
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
  void presenters;
  void ticketCard;

  return (
    <>
      <ShowContentState result={result} heroImage="/images/orchid-dark.jpg" layout="prose" />

      <ShowSectionNav current="/national-show/symposium" />
    </>
  );
}
