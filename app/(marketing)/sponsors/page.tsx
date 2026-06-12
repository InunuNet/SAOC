import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { SponsorGrid } from '@/components/sponsors';
import type { SanitySponsor } from '@/components/sponsors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { partnersQuery } from '@/sanity/queries';

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
          <section className="rounded-lg border border-rule bg-bone p-10 text-center">
            <h2 className="font-serif text-[26px] font-medium text-ink">
              Become our first sponsor
            </h2>
            <p className="mx-auto mt-3 max-w-xl font-sans text-[15px] leading-relaxed text-ink/70">
              SAOC is building a community of partners who support orchid growing, showing,
              and judging across South Africa. Be the first to put your name behind it.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-block rounded-full border border-ink bg-ink px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory"
            >
              Get in touch
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
