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
        {hasSponsors ? (
          <SponsorGrid sponsors={list} />
        ) : (
          <section className="border border-rule bg-bone p-10 text-center">
            <h2 className="font-serif text-[26px] font-medium text-ink">
              Become our first sponsor
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-ink/70">
              SAOC is building a community of partners who support orchid growing, showing,
              and judging across South Africa. Be the first to put your name behind it.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-block bg-ink px-6 py-3 font-sans text-[14px] font-medium text-ivory transition-colors duration-150 hover:bg-ink/85"
            >
              Get in Touch
            </Link>
          </section>
        )}

        <section className="border-t border-rule pt-10 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
            Support SAOC
          </p>
          <h2 className="mt-3 font-serif text-[24px] font-medium text-ink">
            Become a sponsor
          </h2>
          <p className="mx-auto mt-2 max-w-xl font-sans text-[15px] leading-relaxed text-ink/70">
            Partner with the national body coordinating orchid societies since 1968.
          </p>
          <Link
            href="/contact"
            className="mt-5 inline-block text-ink underline underline-offset-2 font-sans text-[15px]"
          >
            Talk to us about sponsorship →
          </Link>
        </section>
      </div>
    </>
  );
}
