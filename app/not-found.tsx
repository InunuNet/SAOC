import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

import { SkipLink, UtilityBar, Header, Footer } from '@/components/chrome';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import type { ShowIdentity } from '@/types';

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you’re looking for doesn’t exist or may have moved. Start from the home page or find a society near you.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export function NotFoundSection() {
  return (
    <section className="relative flex min-h-[640px] items-center overflow-hidden bg-primary">
      <Image
        src="/images/orchid-dark.jpg"
        alt=""
        fill
        priority
        className="object-cover opacity-20"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-8 py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ivory mb-4">
          404 — Page not found
        </p>
        <h1 className="font-serif font-light text-[clamp(42px,6vw,80px)] leading-[1.04] tracking-[-0.015em] text-ivory max-w-[20ch] mx-auto mb-6">
          This orchid has left the bench.
        </h1>
        <p className="font-sans text-[18px] leading-relaxed text-ivory/70 max-w-[46ch] mx-auto mb-10">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved. Start from the
          home page or find a society near you.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="font-sans text-[14px] font-medium bg-accent px-6 py-3 text-ink transition-colors duration-150 hover:bg-accent-soft"
          >
            Go home
          </Link>
          <Link
            href="/societies"
            className="font-sans text-[14px] font-medium border border-ivory/40 px-6 py-3 text-ivory transition-colors duration-150 hover:bg-ivory/10"
          >
            Find a society
          </Link>
        </div>
      </div>
    </section>
  );
}

// An unmatched URL renders here under the root layout alone, which has no chrome. r16 F2 (Codi):
// it composes the SAOC chrome the way app/(marketing)/layout.tsx does, so a mistyped URL keeps the
// site's header, footer and skip link. A notFound() from a marketing page renders
// app/(marketing)/not-found.tsx instead, inside the layout's own chrome.
export default async function NotFound() {
  const show = await sanityFetch<ShowIdentity>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });

  return (
    <>
      <SkipLink />
      <UtilityBar show={show} />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <NotFoundSection />
      </main>
      <Footer showCopyGap={!withholdPlaceholderProse()} />
    </>
  );
}
