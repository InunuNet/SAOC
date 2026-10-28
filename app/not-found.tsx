import type { Metadata } from 'next';

import { SkipLink, Header, Footer } from '@/components/chrome';
import { NotFoundSection, saocNotFoundMetadata } from '@/components/site-chrome/SaocNotFound';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { requestSite } from '@/lib/request-site';
import { SHOW_TITLE } from '@/lib/show-title';

// This route is the one not-found Next renders into the server HTML, so its head is host-aware too:
// the NOS host takes the NOS strings (national-show/not-found.tsx) under the NOS title suffix, the SAOC
// host keeps its own, unchanged. (marketing)/not-found.tsx re-exports the SAOC one as its `metadata`.
export async function generateMetadata(): Promise<Metadata> {
  if ((await requestSite()) !== 'nos') return saocNotFoundMetadata;
  const { metadata: nosNotFoundMetadata } = await import('./(nos)/national-show/not-found');
  return { ...nosNotFoundMetadata, title: { absolute: `Page not found | ${SHOW_TITLE}` } };
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
    // Dynamic imports keep the NOS faces and stylesheets out of every SAOC route's CSS (F1e).
    const [{ NosThemedFrame }, { NosPageNotFound }] = await Promise.all([
      import('@/components/site-chrome/NosThemedFrame'),
      import('./(nos)/national-show/not-found'),
    ]);
    return (
      <NosThemedFrame>
        <NosPageNotFound />
      </NosThemedFrame>
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
