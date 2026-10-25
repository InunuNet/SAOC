import type { Metadata } from 'next';
import Link from 'next/link';

import { SkipLink, Header, Footer } from '@/components/chrome';
import { RouteHero } from '@/components/ui/RouteHero';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you’re looking for doesn’t exist or may have moved. Start from the home page or find a society near you.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export function NotFoundSection() {
  return (
    <RouteHero
      route="/404"
      eyebrow="404 — Page not found"
      heading="This orchid has left the bench."
      lede="The page you’re looking for doesn’t exist or may have moved. Start from the home page or find a society near you."
      actions={
        <div className="mt-10 flex flex-wrap justify-center gap-4">
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
      }
    />
  );
}

// An unmatched URL renders here under the root layout alone, which has no chrome. r16 F2 (Codi):
// it composes the SAOC chrome the way app/(marketing)/layout.tsx does, so a mistyped URL keeps the
// site's header, footer and skip link. A notFound() from a marketing page renders
// app/(marketing)/not-found.tsx instead, inside the layout's own chrome.
export default function NotFound() {
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1}>
        <NotFoundSection />
      </main>
      <Footer showCopyGap={!withholdPlaceholderProse()} />
    </>
  );
}
