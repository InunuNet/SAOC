// =============================================================
// components/site-chrome/SaocFrame.tsx
// The SAOC site chrome around a route group's pages. The skip link, header and the
// footer are body-level siblings of <main id="main-content">: the menu panel inerts everything else
// on the path to <body>, and a <header>/<footer> inside <main> loses its banner/contentinfo
// landmark, which is why a nested layout cannot wrap its children in the chrome itself.
// Used by app/(marketing)/layout.tsx and, on the SAOC host, by app/(shared)/layout.tsx.
// =============================================================

import { SkipLink, Header, Footer } from '@/components/chrome';
import { AdminPill } from '@/components/admin/AdminPill';
import { RouteFocus } from '@/components/site-chrome/RouteFocus';
import { SaocFontPreload } from '@/components/site-chrome/SaocFontPreload';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { saocOrigin } from '@/lib/site-hosts';
import { buildOrganizationJsonLd } from '@/lib/site-metadata';

export function SaocFrame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        // Developer-controlled static JSON (no user input) — safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd(saocOrigin())) }}
      />
      <SaocFontPreload />
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <RouteFocus />
      <Footer showCopyGap={!withholdPlaceholderProse()} />
      <AdminPill />
    </>
  );
}
