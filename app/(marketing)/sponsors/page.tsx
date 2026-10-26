import type { Metadata } from 'next';
import Link from 'next/link';

import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { DocumentLayout } from '@/components/ui/DocumentLayout';
import { PageHero } from '@/components/ui/PageHero';
import { ContentGap } from '@/components/ui/ContentGap';
import { isUnsourced } from '@/components/ui/provenance';
import { PlaceholderMarker } from '@/components/ui/PlaceholderMarker';
import { SponsorGrid } from '@/components/sponsors';
import { SponsorEnquirySection } from '@/components/sponsors/SponsorEnquirySection';
import type { SanitySponsor } from '@/components/sponsors';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { buildPageMetadata } from '@/lib/seo';
import { sanityFetch } from '@/sanity/lib/fetch';
import { partnersQuery } from '@/sanity/queries';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

const LEDE =
  'Organisations and businesses that support orchid growing, showing, and judging across South Africa.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Sponsors',
  description: LEDE,
  lede: LEDE,
  path: '/sponsors',
});

const BENEFITS = [
  'Logo placement on saoc.co.za and event signage',
  'Recognition at the National Show — exhibition space, programme, and banner placement',
  'A feature in Orchids South Africa, our annual yearbook',
  'A mention to our affiliated-society network via newsletter and social channels',
] as const;

const ENQUIRY_CTA_LABEL = 'Talk to us about sponsorship';

const SUPPORT_LEAD =
  'SAOC coordinates orchid growing, showing, hybridising, and judging across South Africa — reaching a national audience through our triennial National Show and annual yearbook.';
const SPONSOR_CTA_BODY =
  'Partner with the national body coordinating orchid societies since 1968. Get in touch to discuss sponsorship of the National Show, the yearbook, or the council itself.';

export default async function SponsorsPage() {
  const sponsors = await sanityFetch<SanitySponsor[]>({
    query: partnersQuery,
    tags: ['sponsor', 'sanity'],
  });

  // F19 (vote 1C): the society and judge counts, the yearbook and its page count are not in the
  // Council's Drive. The beta preview shows them marked; the public build leaves them out.
  const withhold = withholdPlaceholderProse();
  const list = sponsors ?? [];
  const hasSponsors = list.length > 0;
  const benefits = withhold ? BENEFITS.filter((benefit) => !isUnsourced(benefit)) : BENEFITS;

  return (
    <>
      <Breadcrumb items={[{ label: 'Sponsors' }]} />
      <PageHero
        image="/images/orchid-yellow.jpg"
        heading="Sponsors"
        lede={LEDE}
        actions={
          <Link
            href="#enquire"
            className="mt-8 inline-flex min-h-11 items-center rounded-[length:var(--radius-1)] bg-accent px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-accent-soft lg:hidden"
          >
            {ENQUIRY_CTA_LABEL}
          </Link>
        }
      />

      <DocumentLayout
        aside={
          <>
            <h2 className="doc-aside-heading">Become a sponsor</h2>
            {withhold ? null : (
              <div data-placeholder="true" className="flex flex-col items-start">
                <p className="font-sans text-[16px] leading-[1.55] text-ink/70">{SPONSOR_CTA_BODY}</p>
                <PlaceholderMarker />
              </div>
            )}
            <Link
              href="#enquire"
              className="mt-6 inline-flex min-h-11 items-center rounded-[length:var(--radius-1)] bg-accent px-6 py-3 font-sans text-[14px] font-medium text-ink transition-colors duration-150 hover:bg-accent-soft"
            >
              {ENQUIRY_CTA_LABEL}
            </Link>
          </>
        }
      >
        {hasSponsors ? (
          <section className="doc-section">
            <SponsorGrid sponsors={list} />
          </section>
        ) : null}
        {!hasSponsors && withhold ? (
          <section className="doc-section">
            <ContentGap />
          </section>
        ) : null}

        {/* What sponsorship supports */}
        <section className="doc-section">
          <h2 className="doc-h2">What your support funds</h2>
          <div className="doc-prose">
            {withhold ? null : (
              <div data-placeholder="true" className="flex flex-col items-start gap-1">
                <p className="font-serif font-normal text-[20px] leading-[1.55] text-ink">{SUPPORT_LEAD}</p>
                <PlaceholderMarker />
              </div>
            )}
            <p>
              Sponsorship funds the show bench, judging accreditation, and the community events
              that keep orchid growing alive in South Africa — from the National Show down to
              local society meetings.
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="doc-section" data-placeholder="sponsorship-benefits-estimate">
          <h2 className="doc-h2">What sponsors get</h2>
          <div className="doc-prose">
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-muted"
                >
                  {benefit}
                </li>
              ))}
            </ul>
            <p className="text-ink/70">
              Indicative benefits — final sponsorship tiers and pricing are confirmed when you get
              in touch.
            </p>
            {withhold ? null : <PlaceholderMarker />}
          </div>
        </section>

        <SponsorEnquirySection site="saoc" inDocument />
      </DocumentLayout>
    </>
  );
}
