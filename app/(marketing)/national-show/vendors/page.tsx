import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { ConfirmationBadge } from '@/components/show';
import { VendorGrid, VendorIntro } from '@/components/vendors';
import type { SanityVendorNursery } from '@/components/vendors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { vendorNurseriesQuery } from '@/sanity/queries';
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
// VendorIntro/VendorGrid are SAOC-owned, untouched, and already re-skin through the
// inherited nos-theme tokens; this page only composes NOS chrome around them.
export default async function VendorsPage() {
  const nurseries = await sanityFetch<SanityVendorNursery[]>({
    query: vendorNurseriesQuery,
    tags: ['vendorNursery', 'sanity'],
  });

  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        route="/national-show/vendors"
        title="Exhibitors and Vendors"
        lede="Meet the specialist nurseries showcasing their finest orchids at the South African National Orchid Show."
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

      <NosSection wrapClassName="space-y-16 [&_p]:max-w-[60ch]">
        {/* R11: the prose describes a trade floor the committee has not confirmed, so the chip
            sits in the head of the one surface that carries it. */}
        <div className="nos-surface">
          <ConfirmationBadge
            status="pending"
            pendingLabel="To be confirmed by the show committee"
          />
          <VendorIntro />
        </div>

        {list.length > 0 ? (
          <VendorGrid nurseries={list} />
        ) : (
          <div data-nos-empty-state="" className="nos-surface">
            <p className="font-sans text-[15px] leading-relaxed text-ink/80">
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
