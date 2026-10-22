// =============================================================
// components/site-chrome/NosFrame.tsx
// The National Orchid Show own-brand chrome around a route group's pages. Same landmark rule as
// SaocFrame: header and footer are body-level siblings of <main id="main-content">, never inside
// it. NOS has no SAOC utility bar (NOS Design R1.5): "Join a society" and the SAOC contact belong
// to the SAOC site, which the NOS footer credits instead.
// Used by app/(nos)/layout.tsx and, on the NOS host, by app/(shared)/layout.tsx.
// =============================================================

import { AdminPill } from '@/components/admin/AdminPill';
import { NosFooter } from '@/components/nos-chrome/NosFooter';
import { NosHeader } from '@/components/nos-chrome/NosHeader';
import { NosSkipLink } from '@/components/nos-chrome/NosSkipLink';
import { getVisibleNav } from '@/lib/data/past-shows-public';
import { CONTACT_LINK } from '@/components/chrome/nav-config';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { saocUrl } from '@/lib/site-hosts';

export async function NosFrame({ children }: { children: React.ReactNode }) {
  const nav = await getVisibleNav();

  return (
    <>
      <NosSkipLink />
      <NosHeader
        nav={nav}
        saocHomeHref={saocUrl('/')}
        saocContactHref={saocUrl(CONTACT_LINK.href)}
      />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
      <NosFooter showPlaceholders={!withholdPlaceholderProse()} />
      <AdminPill />
    </>
  );
}
