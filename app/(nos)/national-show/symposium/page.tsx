import type { Metadata } from 'next';

import { heroFactsForEvent, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { PresenterSection } from '@/components/nos/PresenterSection';
import { TicketCard } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { loadShowFacts } from '@/lib/data/show-facts';
import { SYMPOSIUM_THEME_LINE } from '@/lib/data/show-page-presentation';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { TICKET_PRODUCTS } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { loadPresenterViewModels } from '@/lib/view-models/load-presenters';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// SY-G1 (NOS Design, comms.md 2026-10-25): the hero names the page by its nav label (NL-1) and carries her
// theme title in her quotation marks; the body is the theme sentence and the first sentence of her
// Symposium paragraph (What to Expect v1.0) beside the live v13 ticket card; then the presenters as PR-1
// profiles. The two builder sections that used to follow the theme (R7) are gone from
// content/show-pages/06-saoc-symposium.json.
//
// The date and hours are the ticket product's own (lib/data/ticket-presentation.ts), the venue is the
// published show facts. `dynamic = 'force-dynamic'` stays because the ticket card reaches Firebase Admin
// (getPoolRemaining -> getSoldCountsByTicketType), the same rule as the workshops page.
export const dynamic = 'force-dynamic';
export const revalidate = 60;

const PAGE_TITLE = 'Symposium';
const EVENT = 'saoc-symposium';
// Symposium Theme document (Drive: National Show / Symposium), the sentence under her theme title, word for word.
const THEME_SENTENCE =
  "Uniting conservation, science, and horticulture to explore how orchids in their natural environments inform responsible growing, breeding, and the sustainability of the orchid industry.";
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
  const [showFacts, presenters, ticketCards] = await Promise.all([
    loadShowFacts(),
    loadPresenterViewModels(EVENT),
    loadTicketCardViewModels().catch((error: unknown) => {
      console.error('[national-show/symposium] loadTicketCardViewModels failed:', error);
      return null;
    }),
  ]);
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

      <div className="nos-ev-body" data-doc-layout="">
        <div data-nos-wrap="">
          <div className="nos-ev-grid">
            <div className="nos-ev-main" data-doc-main="">
              <p className="doc-standfirst">{THEME_SENTENCE}</p>
              <p>{PROGRAMME_SENTENCE}</p>
            </div>
            {card ? (
              <aside className="nos-ev-ticket" data-doc-aside="" data-doc-aside-kind="content" aria-label="Symposium ticket">
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
