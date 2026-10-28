import type { Metadata } from 'next';
import Link from 'next/link';

import { SkipLink, Header, Footer } from '@/components/chrome';
import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { NosFrame } from '@/components/site-chrome/NosFrame';
import { RouteHero } from '@/components/ui/RouteHero';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { requestSite } from '@/lib/request-site';
import { SHOW_TITLE } from '@/lib/show-title';

import {
  NosPageNotFound,
  metadata as nosNotFoundMetadata,
} from './(nos)/national-show/not-found';

export const saocNotFoundMetadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you’re looking for doesn’t exist or may have moved. Start from the home page or find a society near you.',
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

// This route is the one not-found Next renders into the server HTML, so its head is host-aware too:
// the NOS host takes the NOS strings (national-show/not-found.tsx) under the NOS title suffix, the SAOC
// host keeps its own, unchanged. (marketing)/not-found.tsx re-exports the SAOC one as its `metadata`.
export async function generateMetadata(): Promise<Metadata> {
  if ((await requestSite()) !== 'nos') return saocNotFoundMetadata;
  return { ...nosNotFoundMetadata, title: { absolute: `Page not found | ${SHOW_TITLE}` } };
}

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

// An unmatched URL renders here under the root layout alone, which has no chrome. r16 F2 (Codi):
// it composes the SAOC chrome the way app/(marketing)/layout.tsx does, so a mistyped URL keeps the
// site's header, footer and skip link. A notFound() from a marketing page renders
// app/(marketing)/not-found.tsx instead, inside the layout's own chrome.
//
// This is the one not-found Next renders into the server HTML (a notFound() thrown from a page ships
// the `__next_error__` shell, with no lang and no h1 until hydration), and the NOS host's unmatched
// URLs reach it too, so on the NOS host it composes the NOS chrome and the NOS fallback instead.
export default async function NotFound() {
  if ((await requestSite()) === 'nos') {
    return (
      <NosFrame>
        <NosThemeScope>
          <NosPageNotFound />
        </NosThemeScope>
      </NosFrame>
    );
  }
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
