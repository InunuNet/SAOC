import type { Metadata } from 'next';

import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { ShowStatusFoot, ShowStatusLine } from '@/components/show/ShowStatusLine';
import { SalesStatusLine, TicketCard, TicketSection } from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { TICKET_COPY, partnerNameOf, type TicketProductId } from '@/lib/data/ticket-presentation';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Live stock reaches this page through Firebase Admin credentials that exist only at runtime,
// so it can never be prerendered at build time.
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below — no new claim is introduced here.
// Deliberately no Event markup: ticketType carries no session date, and inventing one to
// unlock a rich result is exactly what M6/B8d forbids.
export const metadata: Metadata = buildPageMetadata({
  title: 'Workshops & Field Trips',
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
// Its first sentence is the disclosure body and its second the foot line (the wording is unchanged).
const [SESSIONS_NOTE_BODY, SESSIONS_NOTE_FOOT] = SESSIONS_NOTE.match(/[^.]+\./g) ?? [
  SESSIONS_NOTE,
  '',
];
const SESSIONS_NOTE_CHIP = 'To be confirmed by the show committee';

// Public build (F24, V2): the first sentence is withheld, so the disclosure is composed here as
// chip + foot on the same gold surface ShowStatusLine draws. ShowStatusLine itself is not
// used for this: with no `items` it returns the bare chip and would drop the foot.
const PUBLIC_NOTE_SURFACE_CLASSES =
  'grid gap-5 rounded-[16px] bg-[var(--gold)] px-[clamp(20px,3vw,32px)] pb-6 pt-5 shadow-sm max-[700px]:px-4';
const PUBLIC_NOTE_CHIP_FIT_CLASSES = [
  '[@media(max-width:700px)]:[&>p]:!px-[10px]',
  '[@media(min-width:420px)_and_(max-width:700px)]:[&>p]:!tracking-[0.06em]',
  '[@media(min-width:375px)_and_(max-width:419px)]:[&>p]:!tracking-[0.02em]',
  '[@media(max-width:374px)]:[&>p]:!tracking-[0]',
].join(' ');

const WORKSHOP_PAGE_PRODUCTS: readonly TicketProductId[] = ['sunset', 'workshops'];

export default async function WorkshopsFieldTripsTicketsPage() {
  const { cards, salesOpen } = await loadTicketCardViewModels();
  const withhold = withholdPlaceholderProse();
  const showProvisional = !withhold;

  return (
    <>
      <NosHero
        route="/national-show/workshops"
        title="Workshops & Field Trips"
        lede="Book Sunset Cocktails and guided Field Trip outings at the National Show."
        priority
      />
      <NosSection>
        <div className="nk-sessions-note">
          {withhold ? (
            <div data-status-disclosure="" role="note" className={PUBLIC_NOTE_SURFACE_CLASSES}>
              <div className={PUBLIC_NOTE_CHIP_FIT_CLASSES}>
                <ShowStatusLine status="pending" pendingLabel={SESSIONS_NOTE_CHIP} />
              </div>
              <ShowStatusFoot>{SESSIONS_NOTE_FOOT.trim()}</ShowStatusFoot>
            </div>
          ) : (
            <ShowStatusLine
              status="pending"
              pendingLabel={SESSIONS_NOTE_CHIP}
              items={[SESSIONS_NOTE_BODY.trim().replace(/\.$/, '')]}
              foot={SESSIONS_NOTE_FOOT.trim()}
            />
          )}
        </div>
      </NosSection>
      {!salesOpen ? <SalesStatusLine /> : null}
      <TicketSection id="programme" title={TICKET_COPY.sections.programme} columns={2}>
        {WORKSHOP_PAGE_PRODUCTS.map((id) => {
          const vm = cards[id];
          return vm ? (
            <div key={id} className="nk-wrap">
              <TicketCard
                productId={id}
                vm={vm}
                name={vm.name}
                partnerName={partnerNameOf(id, cards)}
                showProvisional={showProvisional}
              />
            </div>
          ) : null;
        })}
      </TicketSection>
      <NosShowIndex current="/national-show/workshops" currentTone="ink" />
    </>
  );
}
