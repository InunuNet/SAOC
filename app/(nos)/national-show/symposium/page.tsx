import type { Metadata } from 'next';

import { heroFactsForEvent, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { PresenterSection } from '@/components/nos/PresenterSection';
import { showPageProseParts } from '@/components/nos/ShowPageProse';
import { unwrapShowPageResult } from '@/components/show/nos/show-content-state-internal';
import { TicketCard } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { SYMPOSIUM_THEME_LINE } from '@/lib/data/show-page-presentation';
import { loadShowPageOrFallback, withholdPlaceholderProse } from '@/lib/data/show-pages';
import { TICKET_PRODUCTS } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// SY-G1 (NOS Design, comms.md 2026-10-25): the hero names the page by its nav label (NL-1) and carries her
// theme title in her quotation marks; the body is the theme sentence and the first sentence of her
// Symposium paragraph (What to Expect v1.0) beside the live v13 ticket card; then the presenters as PR-1
// profiles. The "About the Symposium" and "Attending" sections were builder copy (R7) and are gone from
// content/show-pages/06-saoc-symposium.json.
//
// The date and hours are the ticket product's own (lib/data/ticket-presentation.ts), the venue is the
// published show facts. `dynamic = 'force-dynamic'` stays because the ticket card reaches Firebase Admin
// (getPoolRemaining -> getSoldCountsByTicketType), the same rule as the workshops page.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PAGE_TITLE = 'Symposium';
const EVENT = 'saoc-symposium';
const THEME_SECTION_KEY = 'theme';
// What to Expect v1.0, the Symposium paragraph: its first sentence, word for word.
const PROGRAMME_SENTENCE =
  "The National Show Symposium will feature an outstanding programme of presentations by respected local and international speakers covering orchid cultivation, breeding, conservation, taxonomy, judging, sustainability and emerging scientific research.";

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  image: nosOgImage('Symposium — National Orchid Show'),
  description:
    'Uniting conservation, science, and horticulture to explore how orchids in their natural environments inform responsible growing, breeding, and the…',
  path: '/national-show/symposium',
});

export default async function SymposiumPage() {
  // A Sanity or Firebase failure must never turn this public page into a 500 (Codex finding, 2026-10-07).
  const [result, showFacts, presenters, ticketCards] = await Promise.all([
    loadShowPageOrFallback('06-saoc-symposium', {
      label: PAGE_TITLE,
      purpose: 'The National Orchid Show Symposium: what it is, its theme, and who it is for.',
    }),
    loadShowFacts(),
    loadPresenterViewModels(EVENT),
    loadTicketCardViewModels().catch((error: unknown) => {
      console.error('[national-show/symposium] loadTicketCardViewModels failed:', error);
      return null;
    }),
  ]);
  const page = unwrapShowPageResult(result);
  const themeSection = page.sections.find((section) => section.sectionKey === THEME_SECTION_KEY);
  const [themeSentence] = (themeSection ? showPageProseParts(themeSection) : null)?.paragraphs ?? [];
  const card = ticketCards?.cards.symposium ?? null;

  return (
    <>
      <NosHero
        route="/national-show/symposium"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        lede={`\u201c${SYMPOSIUM_THEME_LINE}\u201d`}
        ledeKind="theme"
        facts={heroFactsForEvent(showFacts, TICKET_PRODUCTS.symposium)}
        priority
      />

      <div className="nos-ev-body">
        <div data-nos-wrap="">
          <div className="nos-ev-grid">
            <div className="nos-ev-main">
              {themeSentence ? <p className="doc-standfirst">{themeSentence}</p> : null}
              <p>{PROGRAMME_SENTENCE}</p>
            </div>
            {card ? (
              <aside className="nos-ev-ticket" aria-label="Symposium ticket">
                <div className="nk-grid">
                  <div className="nk-wrap">
                    <TicketCard
                      productId="symposium"
                      vm={card}
                      name={card.name}
                      partnerName={null}
                      showProvisional={!withholdPlaceholderProse()}
                    />
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
          <PresenterSection presenters={presenters} />
        </div>
      </div>
      <NosShowIndex current="/national-show/symposium" />
    </>
  );
}
