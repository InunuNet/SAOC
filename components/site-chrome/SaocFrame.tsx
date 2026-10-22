// =============================================================
// components/site-chrome/SaocFrame.tsx
// The SAOC site chrome around a route group's pages. The skip link, utility bar and header and the
// footer are body-level siblings of <main id="main-content">: the menu panel inerts everything else
// on the path to <body>, and a <header>/<footer> inside <main> loses its banner/contentinfo
// landmark, which is why a nested layout cannot wrap its children in the chrome itself.
// Used by app/(marketing)/layout.tsx and, on the SAOC host, by app/(shared)/layout.tsx.
// =============================================================

import { SkipLink, UtilityBar, Header, Footer } from '@/components/chrome';
import { AdminPill } from '@/components/admin/AdminPill';
import { saocOrigin } from '@/lib/site-hosts';
import { buildOrganizationJsonLd } from '@/lib/site-metadata';
import { sanityFetch } from '@/sanity/lib/fetch';
import { nationalShowQuery } from '@/sanity/queries';
import type { ShowIdentity } from '@/types';

// F7: the utility bar's show pill renders on every SAOC page, so the show-identity facts it needs
// are fetched once here rather than hardcoded into the component.
export async function SaocFrame({ children }: { children: React.ReactNode }) {
  const show = await sanityFetch<ShowIdentity>({
    query: nationalShowQuery,
    tags: ['nationalShow', 'sanity'],
  });

  return (
    <>
      <script
        type="application/ld+json"
        // Developer-controlled static JSON (no user input) — safe to inline.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildOrganizationJsonLd(saocOrigin())) }}
      />
      <SkipLink />
      <UtilityBar show={show} />
      <Header show={show} />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <AdminPill />
    </>
  );
}
