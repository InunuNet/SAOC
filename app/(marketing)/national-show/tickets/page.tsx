import type { Metadata } from 'next';
import Link from 'next/link';

import { Badge } from '@/components/nos/Badge';
import { Button } from '@/components/nos/Button';
import { Card } from '@/components/nos/Card';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { SalesClosedNotice } from '@/components/tickets';
import { OzowSandboxTestModeBanner } from '@/components/tickets/OzowSandboxTestModeBanner';
import { AdmissionRows } from '@/components/tickets/AdmissionRows';
import { TicketAudienceIndex } from '@/components/tickets/TicketAudienceIndex';
import { buildAdmissionRows } from '@/lib/admission-rows';
import { getAdmissionSoldOutBySlug } from '@/lib/data/admission-availability';
import { resolveActiveShow } from '@/lib/show-resolution';
import { viewerIsVerifiedAdmin } from '@/lib/admin-viewer';
import { filterPubliclyListableTicketTypes } from '@/lib/demo-ticket-type';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  activeShowWindowQuery,
  activeTicketTypesByCategoryQuery,
  nationalShowSalesQuery,
  ticketsPageQuery,
} from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// F16: the Ozow test-mode strip is shown to verified admins only, which reads the session
// cookie, so this route renders per request (Sanity reads stay in the data cache).
export const dynamic = 'force-dynamic';

// Description restates the page's own rendered lede below. This route is a five-product
// router, so it is never used as an Offer target — those point at /tickets/<slug> (M6/B8b).
export const metadata: Metadata = buildPageMetadata({
  title: 'Tickets — National Show',
  image: nosOgImage('Tickets — National Show'),
  description:
    "Choose the option that matches why you're coming to the 2027 National Orchid Show — " +
    "we'll take you straight to the right form.",
  path: '/national-show/tickets',
});

// F8 (nos-design-system, M3): the visitor-admission option used to be one of five equal
// cards. It is now the dominant front-door block below, carrying a real price; these four
// remain the secondary routes for every other reason someone lands on this page. Copy is
// preserved verbatim from the pre-restyle page — see CLAUDE.md "no invented content".
const SECONDARY_OPTIONS = [
  {
    id: 'exhibitor',
    heading: "I'm exhibiting orchids",
    body: 'See what is involved in exhibiting at the National Show. Entry sales are not yet open — they open closer to the show.',
    cta: 'Exhibitor entry',
    href: '/national-show/exhibitors',
  },
  {
    id: 'vendor',
    heading: "I'm a nursery or trader",
    body: 'Register a trade booth to sell plants and supplies at the show.',
    cta: 'Vendor registration',
    href: '/national-show/vendors/apply',
  },
  {
    id: 'conferences',
    heading: "I'm attending a conference",
    body: 'Register for the Symposium or the WOSA Conference.',
    cta: 'Conferences tickets',
    href: '/national-show/conferences',
  },
  {
    id: 'workshops',
    heading: 'I want workshops or a field trip',
    body: 'Book Sunset Cocktails or a guided Field Trip outing at the show.',
    cta: 'Workshops & Field Trips tickets',
    href: '/national-show/workshops',
  },
] as const;

interface SanityAdmissionTicketType {
  _id: string;
  name: string;
  slug: string;
  price: number;
  regularPrice?: number | null;
  earlyBirdCutoff?: string | null;
  requiresDaySelection?: boolean | null;
  provisional?: boolean | null;
  demo?: boolean | null;
  capacity: number;
  releasedQuantity?: number | null;
  capacityPool?: string | null;
  headcountPerUnit?: number | null;
  order: number;
}

interface ShowActivation {
  _id: string;
  active: boolean | null;
}

interface NationalShowSalesState {
  salesOpen?: boolean | null;
}

export default async function NationalShowTicketsPage() {
  const [ticketTypes, salesState, pageData, allShows, isAdmin] = await Promise.all([
    sanityFetch<SanityAdmissionTicketType[]>({
      query: activeTicketTypesByCategoryQuery,
      params: { category: 'admission' },
      tags: ['ticketType', 'sanity'],
    }),
    sanityFetch<NationalShowSalesState>({
      query: nationalShowSalesQuery,
      tags: ['nationalShow', 'sanity'],
    }),
    sanityFetch<{ buyButtonLabel?: string | null; soldOutMessage?: string | null }>({
      query: ticketsPageQuery,
      tags: ['ticketsPage', 'sanity'],
    }),
    sanityFetch<ShowActivation[]>({ query: activeShowWindowQuery, tags: ['show', 'sanity'] }),
    viewerIsVerifiedAdmin(),
  ]);

  const salesOpen = salesState?.salesOpen === true;
  // The same filter /tickets uses drops demo products, so every link below resolves on /tickets/[slug].
  const admissionProducts = filterPubliclyListableTicketTypes(ticketTypes ?? []);
  // Display hint only (checkout re-checks capacity): which SKUs are sold out, so a sold-out
  // early-bird shows its state on its own action while the regular ticket stays live.
  const soldOutBySlug = salesOpen
    ? await getAdmissionSoldOutBySlug(admissionProducts, resolveActiveShow(allShows ?? []))
    : {};
  const rows = buildAdmissionRows(
    admissionProducts.map((t) => ({ ...t, soldOut: soldOutBySlug[t.slug] === true })),
    { now: new Date() },
  );
  const buyLabel = pageData?.buyButtonLabel ?? 'Buy Ticket';
  const soldOutLabel = pageData?.soldOutMessage ?? 'Sold out';
  const showProvisionalNote = salesOpen && rows.some((r) => r.provisional);

  return (
    <>
      <NosHero
        route="/national-show/tickets"
        title="What are you here for?"
        lede="Choose the option that matches why you're coming to the 2027 National Orchid Show — we'll take you straight to the right form."
        priority
      />
      <TicketAudienceIndex />

      <NosSection wrapClassName="space-y-16">
        <div id="visit" data-nos-group="" role="group" aria-labelledby="visit-heading">
          {isAdmin ? <OzowSandboxTestModeBanner /> : null}
          <div className="flex flex-col gap-4">
            <Badge tone="purple" className="w-fit">Visitor admission</Badge>
            <h2 id="visit-heading" className="font-serif text-ink">I&rsquo;m coming to visit</h2>
            <p className="font-sans text-[16px] leading-relaxed text-muted">
              Buy an admission ticket to browse the show floor, exhibits, and displays.
            </p>
            {showProvisionalNote ? (
              <p className="font-sans text-[12px] italic text-muted">Provisional pricing — subject to change.</p>
            ) : null}
          </div>
          <div className="mt-8">
            {rows.length > 0 ? (
              <AdmissionRows
                rows={rows}
                salesOpen={salesOpen}
                buyLabel={buyLabel}
                soldOutLabel={soldOutLabel}
              />
            ) : (
              <Button as={Link} href="/tickets" variant="primary" className="w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2">
                Get visitor tickets
              </Button>
            )}
            {!salesOpen ? (
              <div data-ticket-closed="" className="mt-8">
                <SalesClosedNotice message="Ticket sales are not yet open — check back soon." />
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {SECONDARY_OPTIONS.filter((o) => o.id === 'exhibitor' || o.id === 'vendor').map((option) => (
              <OptionCard key={option.id} option={option} id={option.id === 'exhibitor' ? 'exhibit' : 'trade'} />
            ))}
          </div>
          <div id="conference-workshops" data-nos-group="" role="group" aria-label="Conference & Workshops" className="grid gap-6 sm:grid-cols-2">
            {SECONDARY_OPTIONS.filter((o) => o.id === 'conferences' || o.id === 'workshops').map((option) => (
              <OptionCard key={option.id} option={option} />
            ))}
          </div>
        </div>
      </NosSection>
      <NosShowIndex current="/national-show/tickets" currentTone="ink" />
    </>
  );
}

function OptionCard({ option, id }: { option: (typeof SECONDARY_OPTIONS)[number]; id?: string }) {
  return (
    <Card id={id} data-nos-group={id ? '' : undefined} className="flex flex-col gap-4">
      <h3 className="font-serif text-[20px] font-medium text-ink">{option.heading}</h3>
      <p className="font-sans text-[17px] leading-relaxed text-muted">{option.body}</p>
      <Button as={Link} href={option.href} variant="ghost" data-nos-nowrap="" className="mt-auto w-fit whitespace-nowrap max-sm:w-full max-sm:!px-2">
        <span>{option.cta}</span>
      </Button>
    </Card>
  );
}
