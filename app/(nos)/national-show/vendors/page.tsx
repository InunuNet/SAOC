import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { VendorGrid } from '@/components/vendors';
import type { SanityVendorNursery } from '@/components/vendors';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { vendorNurseriesQuery } from '@/sanity/queries';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// SX-G1 delta onto /vendors (NOS Design, comms.md 2026-10-25): Lee-Ann ruled one page for exhibitors
// and vendors (V1), so this page carries her "South African Exhibitors" v1.1 introduction: her
// tagline as the standfirst, her four paragraphs, and her "Available at the Show" list in the aside.
// All of it is hers, word for word. There is no lede: the line this page used to carry was builder
// copy. Her list of 21 invited vendors is not rendered (D-SX1: it waits on her answer); confirmed
// nurseries from the CMS appear below the introduction. No Event or Offer markup on any vendor
// route: the flow is invitation-gated, which Google excludes from the event experience (M6/B8c).
const PAGE_TITLE = 'Exhibitors and vendors';
const APPLY_HREF = '/vendors/apply';
const APPLY_LABEL = 'Vendor application';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

const STANDFIRST = 'Showcasing the Finest in South African Orchid Growing';

const PARAGRAPHS = [
  "The National Orchid Show - Western Cape 2027 will proudly showcase the country's leading orchid growers, specialist nurseries, orchid societies and commercial exhibitors, bringing together an exceptional collection of South Africa's finest orchids and related products under one roof.",
  "Visitors will have the opportunity to meet the passionate individuals and organisations whose dedication, knowledge and years of experience have helped shape South Africa's vibrant orchid community. From internationally recognised breeders and award-winning exhibitors to specialist species growers and emerging enthusiasts, the exhibition celebrates the remarkable diversity and excellence of orchid cultivation across the country.",
  "Exhibitors will present stunning displays of species and hybrid orchids, compete for prestigious national awards, and share their expertise through demonstrations, discussions and informal conversations throughout the event. The plant sales area will offer visitors the opportunity to purchase exceptional orchids, growing media, pots, accessories and specialist products directly from many of South Africa's most respected orchid nurseries.",
  "Whether you are building your first orchid collection or searching for a rare specimen to add to an established collection, the South African Exhibitors Pavilion offers a unique opportunity to learn from the country's leading growers while celebrating the innovation, craftsmanship and horticultural excellence that continue to place South African orchid growing on the international stage.",
];

const AVAILABLE_HEADING = 'Available at the Show';
const AVAILABLE_ITEMS = [
  'Species orchids',
  'Hybrids',
  'Miniatures',
  'South American species',
  'Asian species',
  'Growing supplies',
];

export const metadata: Metadata = buildPageMetadata({
  title: PAGE_TITLE,
  image: nosOgImage('Exhibitors and vendors — National Show'),
  description: STANDFIRST,
  path: '/national-show/vendors',
});

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export default async function VendorsPage() {
  const [nurseries, facts] = await Promise.all([
    sanityFetch<SanityVendorNursery[]>({
      query: vendorNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
    loadShowFacts(),
  ]);
  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        route="/national-show/vendors"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(facts, FACTS_LABELS)}
        priority
        actions={
          <Button<typeof Link>
            as={Link}
            href={APPLY_HREF}
            variant="on-dark"
            className="nos-sp-hero-cta"
            data-nos-hero-button=""
          >
            {APPLY_LABEL}
            <Arrow />
          </Button>
        }
      />

      <DocumentLayout
        aside={
          <div data-vendors-card="" className="nos-sp-card">
            <h2 className="nos-sp-card-title">{AVAILABLE_HEADING}</h2>
            <ul className="nos-sx-cats">
              {AVAILABLE_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Button<typeof Link>
              as={Link}
              href={APPLY_HREF}
              className="nos-sp-card-cta"
              data-vendors-apply=""
            >
              {APPLY_LABEL}
              <Arrow />
            </Button>
          </div>
        }
      >
        <div className="doc-prose">
          <p className="doc-standfirst">{STANDFIRST}</p>
          {PARAGRAPHS.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </DocumentLayout>

      {list.length > 0 ? (
        <NosSection wrapClassName="space-y-16 [&_p]:max-w-[60ch]">
          <VendorGrid nurseries={list} />
        </NosSection>
      ) : null}
      <NosShowIndex current="/national-show/vendors" />
    </>
  );
}
