import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { SponsorGrid } from '@/components/sponsors';
import type { SanitySponsor } from '@/components/sponsors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { partnersQuery } from '@/sanity/queries';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Sponsors' };

const REACH_STATS = [
  { value: '21', label: 'Affiliated Societies' },
  { value: '1968', label: 'Founding Year' },
  { value: '18', label: 'National Shows Hosted' },
  { value: '56', label: 'Accredited Judges' },
] as const;

const BENEFITS = [
  'Logo placement on saoc.co.za and event signage',
  'Recognition at the National Show — exhibition space, programme, and banner placement',
  'A feature in Orchids South Africa, our 184-page annual yearbook',
  'A mention to our affiliated-society network via newsletter and social channels',
] as const;

export default async function SponsorsPage() {
  const sponsors = await sanityFetch<SanitySponsor[]>({
    query: partnersQuery,
    tags: ['sponsor', 'sanity'],
  });

  const list = sponsors ?? [];
  const hasSponsors = list.length > 0;

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="Our sponsors"
        heading="The partners behind SAOC"
        lede="Organisations and businesses that support orchid growing, showing, and judging across South Africa."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        {hasSponsors ? <SponsorGrid sponsors={list} /> : null}

        {/* What sponsorship supports */}
        <section className="max-w-[720px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            What your support funds
          </p>
          <p className="font-serif text-[20px] leading-relaxed text-ink">
            SAOC coordinates orchid growing, showing, hybridising, and judging across South
            Africa — reaching a national audience of 21 affiliated societies through our
            triennial National Show and annual yearbook.
          </p>
          <p className="mt-4 font-sans text-[16px] leading-relaxed text-ink/80">
            Sponsorship funds the show bench, judging accreditation, and the community events
            that keep orchid growing alive in South Africa — from the National Show down to
            local society meetings.
          </p>
        </section>

        {/* Reach — reused stat treatment from the home page */}
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            Our reach
          </p>
          <dl className="grid grid-cols-2 gap-8 border-y border-rule py-10 sm:grid-cols-4">
            {REACH_STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="font-serif text-[32px] font-medium text-ink">{stat.value}</dt>
                <dd className="mt-1 font-mono text-[11px] tracking-[0.16em] text-muted">
                  {stat.label}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Benefits */}
        <section className="max-w-[720px]" data-placeholder="sponsorship-benefits-estimate">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted mb-6">
            What sponsors get
          </p>
          <ul className="space-y-3">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit}
                className="font-sans text-[16px] leading-relaxed text-ink/80 pl-5 relative before:content-['—'] before:absolute before:left-0 before:text-muted"
              >
                {benefit}
              </li>
            ))}
          </ul>
          <p className="mt-4 font-sans text-[13px] leading-relaxed text-ink/60">
            Indicative benefits — final sponsorship tiers and pricing are confirmed when you get
            in touch.
          </p>
        </section>

        {/* Single consolidated CTA */}
        <section className="border border-rule bg-bone p-10 text-center">
          <h2 className="font-serif text-[26px] font-medium text-ink">Become a sponsor</h2>
          <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-ink/70">
            Partner with the national body coordinating orchid societies since 1968. Get in
            touch to discuss sponsorship of the National Show, the yearbook, or the council
            itself.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-block bg-ink px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-ink/85"
          >
            Talk to us about sponsorship
          </Link>
        </section>
      </div>
    </>
  );
}
