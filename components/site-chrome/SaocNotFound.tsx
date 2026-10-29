// =============================================================
// components/site-chrome/SaocNotFound.tsx
// The SAOC 404 section and its metadata, in a module of their own so (marketing)/not-found.tsx can
// import them without importing app/not-found.tsx (F1e).
// =============================================================

import type { Metadata } from 'next';
import Link from 'next/link';

import { RouteHero } from '@/components/ui/RouteHero';

export const saocNotFoundMetadata: Metadata = {
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
            className="font-sans text-[14px] font-medium bg-accent px-6 py-3 text-ink transition-colors duration-150 hover:bg-accent-soft outline-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]"
          >
            Go home
          </Link>
          <Link
            href="/societies"
            className="font-sans text-[14px] font-medium border border-ivory/40 px-6 py-3 text-ivory transition-colors duration-150 hover:bg-ivory/10 outline-ivory focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ivory focus-visible:outline-offset-[3px]"
          >
            Find a society
          </Link>
        </div>
      }
    />
  );
}
