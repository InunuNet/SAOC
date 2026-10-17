import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { NAV } from '@/components/chrome/nav-config';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import {
  ArrowIcon,
  PoolBanner,
  SalesStatusLine,
  TicketCard,
  TicketSection,
  TicketsMasthead,
  type VisitLink,
} from '@/components/tickets/keepsake';
import { loadTicketCardViewModels } from '@/lib/data/admission-availability';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { countDisplay } from '@/lib/data/ticket-count-display';
import { buildSectionLedes } from '@/lib/data/ticket-section-ledes';
import { buildShowFacts, type ShowFactsSource } from '@/lib/data/show-facts';
import {
  BEFORE_YOU_VISIT_HREFS,
  TICKET_COPY,
  TICKET_PRODUCTS,
  type TicketProductId,
  partnerNameOf,
} from '@/lib/data/ticket-presentation';
import { viewerIsVerifiedAdmin } from '@/lib/admin-viewer';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';

// The Ozow test-mode strip is shown to verified admins only, which reads the session cookie, so
// this route renders per request (Sanity reads stay in the data cache).
export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  title: 'Tickets — National Show',
  image: nosOgImage('Tickets — National Show'),
  description:
    "Choose the option that matches why you're coming to the 2027 National Orchid Show — " +
    "we'll take you straight to the right form.",
  path: '/national-show/tickets',
});

// The exhibitor and trade routes are not tickets: they stay as a compact two-card row at the
// foot of the hub, with no stub. Copy is preserved verbatim from the pre-v13 page.
const FOOT_OPTIONS = [
  {
    id: 'exhibit',
    heading: "I'm exhibiting orchids",
    body: 'See what is involved in exhibiting at the National Show. Entry sales are not yet open — they open closer to the show.',
    cta: 'Exhibitor entry',
    href: '/national-show/exhibitors',
  },
  {
    id: 'trade',
    heading: "I'm a nursery or trader",
    body: 'Trade vendor showcase, application and gated registration.',
    cta: 'Vendor registration',
    href: '/national-show/vendors/apply',
  },
] as const;

const THURSDAY_PRODUCTS: readonly TicketProductId[] = ['vip', 'sunset'];
const PASS_PRODUCTS: readonly TicketProductId[] = ['weekend', 'day'];
const PROGRAMME_PRODUCTS: readonly TicketProductId[] = ['symposium', 'wosa', 'workshops'];

// The mega's own leaves, so the "Before you visit" labels can never differ from the header's.
function resolveVisitLinks(): VisitLink[] {
  const mega = NAV.find((n) => n.type === 'mega');
  const leaves = mega?.columns.flatMap((c) => c.links) ?? [];
  return BEFORE_YOU_VISIT_HREFS.map((href) => {
    const leaf = leaves.find((l) => l.href === href);
    if (!leaf) throw new Error(`no leaf for ${href}`);
    return { label: leaf.label, href };
  });
}

const VISIT_LINKS = resolveVisitLinks();

interface ShowIdentityFields extends ShowFactsSource {
  edition?: number | null;
  countdownDate?: string | null;
  showDate?: string | null;
  showEndDate?: string | null;
}

export default async function NationalShowTicketsPage() {
  const [show, loaded, isAdmin] = await Promise.all([
    sanityFetch<ShowIdentityFields>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] }),
    loadTicketCardViewModels(),
    viewerIsVerifiedAdmin(),
  ]);
  const { cards, pool, dayPassFrom, salesOpen, provisionalTotals } = loaded;
  const withhold = withholdPlaceholderProse();
  const ledes = buildSectionLedes({
    showDate: show?.showDate ?? null,
    showEndDate: show?.showEndDate ?? null,
    has: {
      vip: Boolean(cards.vip),
      sunset: Boolean(cards.sunset),
      symposium: Boolean(cards.symposium),
      wosa: Boolean(cards.wosa),
      workshops: Boolean(cards.workshops),
    },
    names: {
      symposium: cards.symposium?.name ?? null,
      wosa: cards.wosa?.name ?? null,
      workshops: cards.workshops?.name ?? TICKET_PRODUCTS.workshops.name,
    },
  });
  const has = (ids: readonly TicketProductId[]) => ids.some((id) => cards[id]);
  const renderCards = (ids: readonly TicketProductId[]) =>
    ids.map((id) => {
      const vm = cards[id];
      return vm ? (
        <div key={id} className="nk-wrap">
          <TicketCard
            productId={id}
            vm={vm}
            name={vm.name}
            partnerName={partnerNameOf(id, cards)}
            counts={countDisplay(provisionalTotals.bySlug[vm.slug] === true, withhold)}
            dayCounts={countDisplay(provisionalTotals.day, withhold)}
          />
        </div>
      ) : null;
    });

  return (
    <>
      <TicketsMasthead
        facts={buildShowFacts(show)}
        countdownDate={show?.countdownDate ?? null}
        edition={show?.edition ?? null}
        visitLinks={VISIT_LINKS}
        cards={cards}
        dayPassFrom={dayPassFrom}
      />
      {!salesOpen ? <SalesStatusLine /> : null}

      {has(THURSDAY_PRODUCTS) ? (
        <TicketSection
          id="thursday"
          title={TICKET_COPY.sections.thursday}
          lede={ledes.thursday}
          columns={2}
          lead={isAdmin && salesOpen ? <OzowSandboxTestModeBanner /> : null}
        >
          {renderCards(THURSDAY_PRODUCTS)}
        </TicketSection>
      ) : null}
      {has(PASS_PRODUCTS) ? (
        <TicketSection
          id="passes"
          title={TICKET_COPY.sections.passes}
          lede={ledes.passes}
          columns={2}
          lead={<PoolBanner pool={pool} counts={countDisplay(provisionalTotals.pool, withhold)} />}
        >
          {renderCards(PASS_PRODUCTS)}
        </TicketSection>
      ) : null}
      {has(PROGRAMME_PRODUCTS) ? (
        <TicketSection
          id="programme"
          title={TICKET_COPY.sections.programme}
          lede={ledes.programme}
          columns={3}
        >
          {renderCards(PROGRAMME_PRODUCTS)}
        </TicketSection>
      ) : null}

      <NosSection>
        <div className="nk-grid-foot">
          {FOOT_OPTIONS.map((option) => (
            <Card
              key={option.id}
              id={option.id}
              data-nos-group=""
              className="nk-opt flex flex-col gap-4"
            >
              <h3 className="font-serif text-[20px] font-medium text-ink">{option.heading}</h3>
              <p className="font-sans text-[17px] leading-relaxed text-muted">{option.body}</p>
              <Button
                as={Link}
                href={option.href}
                variant="ghost"
                data-nos-nowrap=""
                className="mt-auto w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2"
              >
                <span>{option.cta}</span>
                <ArrowIcon />
              </Button>
            </Card>
          ))}
        </div>
      </NosSection>
      <NosShowIndex current="/national-show/tickets" currentTone="ink" />
    </>
  );
}
