import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { LongFormPage } from '@/components/nos/LongFormPage';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ConfirmationBadge } from '@/components/show';
import { VendorGrid } from '@/components/vendors';
import type { SanityVendorNursery } from '@/components/vendors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { vendorNurseriesQuery } from '@/sanity/queries';
import { loadShowFacts } from '@/lib/data/show-facts';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(marketing)/national-show/og-image';
import { NosShowIndex } from '@/components/nos/NosShowIndex';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// Description restates the page's own rendered lede below. No Event or Offer markup on any
// vendor route: the flow is invitation-gated, which Google excludes from the event
// experience (M6/B8c).
export const metadata: Metadata = buildPageMetadata({
  title: 'Exhibitors and Vendors — National Show',
  image: nosOgImage('Exhibitors and Vendors — National Show'),
  description:
    'Meet the specialist nurseries showcasing their finest orchids at the South African ' +
    'National Orchid Show.',
  path: '/national-show/vendors',
});

// F10 (nos-design-system, M3): borrows the World Orchid Conference's prestige framing
// (research item D) — a curated trade floor of named nurseries, not a bureaucratic listing.
// VendorGrid is SAOC-owned, untouched, and already re-skins through the inherited
// nos-theme tokens; this page only composes NOS chrome around it.
//
// F18 (R75): the intro is Lee-Ann's verbatim "South African Exhibitors" copy, now laid out by
// the shared long-form template. components/vendors/VendorIntro.tsx stays untouched and
// carries the same copy; the paragraphs below are word-for-word the same, written with the
// same straight apostrophes (react-dom/server would encode a plain apostrophe as &#x27;, so
// they are set as HTML like VendorIntro sets them).
const VENDORS_LEDE =
  'Meet the specialist nurseries showcasing their finest orchids at the South African National Orchid Show.';

const INTRO_HEADING = 'Showcasing the Finest in South African Orchid Growing';

const INTRO_PARAGRAPHS = [
  "The 2027 South African National Orchid Show will proudly showcase the country's leading " +
    'orchid growers, specialist nurseries, orchid societies and commercial exhibitors, ' +
    "bringing together an exceptional collection of South Africa's finest orchids under one " +
    'roof.',
  'Visitors will have the opportunity to meet the passionate individuals and organisations ' +
    "whose dedication, knowledge and years of experience have helped shape South Africa's " +
    'vibrant orchid community. From internationally recognised breeders and award-winning ' +
    'exhibitors to specialist species growers and emerging enthusiasts, the exhibition ' +
    'celebrates the remarkable diversity and excellence of orchid cultivation across the ' +
    'country.',
  'Exhibitors will present stunning displays of species and hybrid orchids, compete for ' +
    'prestigious national awards, and share their expertise through demonstrations, ' +
    'discussions and informal conversations throughout the event. The plant sales area will ' +
    'offer visitors the opportunity to purchase exceptional orchids, growing media, pots, ' +
    "accessories and specialist products directly from many of South Africa's most respected " +
    'orchid nurseries.',
  'Whether you are building your first orchid collection or searching for a rare specimen to ' +
    'complete an established collection, the South African Exhibitors Pavilion offers a ' +
    "unique opportunity to learn from the country's leading growers while celebrating the " +
    'innovation, craftsmanship and horticultural excellence that continue to place South ' +
    'African orchid growing on the international stage.',
];

export default async function VendorsPage() {
  const [nurseries, facts] = await Promise.all([
    sanityFetch<SanityVendorNursery[]>({
      query: vendorNurseriesQuery,
      tags: ['vendorNursery', 'sanity'],
    }),
    loadShowFacts(),
  ]);

  const list = nurseries ?? [];
  // R56 #1: a public page with no confirmed vendor holds without the lede that promises them.
  const holding = withholdPlaceholderProse() && list.length === 0;

  return (
    <>
      <NosHero
        route="/national-show/vendors"
        title="Exhibitors and Vendors"
        lede={holding ? undefined : VENDORS_LEDE}
        priority
        actions={
          <Button<typeof Link>
            as={Link}
            href="/national-show/vendors/apply"
            variant="on-dark"
            data-nos-hero-button=""
          >
            Vendor Application
          </Button>
        }
      />

      <NosSection>
        <LongFormPage
          facts={facts}
          heading={INTRO_HEADING}
          cta={false}
          // R11: the prose describes a trade floor the committee has not confirmed, so the chip
          // sits in the head of the section. It is a beta-only note (TBC notes never reach the
          // public site).
          marker={
            withholdPlaceholderProse() ? null : (
              <ConfirmationBadge
                status="pending"
                pendingLabel="To be confirmed by the show committee"
              />
            )
          }
          paragraphs={INTRO_PARAGRAPHS.map((paragraph) => (
            <span key={paragraph} dangerouslySetInnerHTML={{ __html: paragraph }} />
          ))}
        />
      </NosSection>

      <NosSection wrapClassName="space-y-16 [&_p]:max-w-[60ch]">
        {list.length > 0 ? (
          <VendorGrid nurseries={list} />
        ) : (
          <div data-nos-empty-state="" className="nos-surface">
            <p className="font-sans text-[length:var(--fs-body,1rem)] leading-[1.55] text-ink/80">
              No nurseries have been confirmed for the South African Exhibitors Pavilion yet.
            </p>
            <div className="mt-6">
              <Button<typeof Link> as={Link} href="/national-show/vendors/apply" variant="primary">
                Vendor Application
              </Button>
            </div>
          </div>
        )}
      </NosSection>

      <CtaBand
        title="Interested in exhibiting at the 2027 National Orchid Show?"
        action={
          <Button as={Link} href="/national-show/vendors/apply" variant="on-dark">
            Register as a vendor
          </Button>
        }
      />
      <NosShowIndex current="/national-show/vendors" />
    </>
  );
}
