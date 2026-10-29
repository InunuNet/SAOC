import type { Metadata } from 'next';

import { SkipLink, Header, Footer } from '@/components/chrome';
import { NotFoundSection, saocNotFoundMetadata } from '@/components/site-chrome/SaocNotFound';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';

export const metadata: Metadata = saocNotFoundMetadata;

// An unmatched URL that no catch-all claims renders here under the root layout alone, which has no
// chrome. r16 F2 (Codi): it composes the SAOC chrome the way app/(marketing)/layout.tsx does, so a
// mistyped URL keeps the site's header, footer and skip link.
//
// Host-neutral on purpose: reading the request host (headers()) here made every route in the app
// dynamic, so each page hit Sanity on every request. Host-correct 404s come from the catch-alls
// instead: app/(marketing)/[...slug] (SAOC) and app/(nos)/national-show/[...slug] (NOS, which
// proxy.ts rewrites every unmatched NOS path into) each call notFound() inside their own layout.
// The SAOC section and its metadata live in components/site-chrome/SaocNotFound.tsx so no other
// not-found has to import this file (F1e). No font preload here: Next serialises this tree into every
// route's payload, so a preload rendered here would be emitted a second time on every SAOC page; the
// SAOC chrome's own preload (SaocFrame) covers every route that renders inside it.
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
