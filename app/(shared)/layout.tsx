import type { Metadata } from 'next';

import { SaocFrame } from '@/components/site-chrome/SaocFrame';
import { requestSite } from '@/lib/request-site';
import { SHOW_TITLE } from '@/lib/show-title';
import { nosOrigin, saocOrigin } from '@/lib/site-hosts';
import { NOS_TITLE, buildSiteMetadata } from '@/lib/site-metadata';

// nos-site-split F1: host-neutral content (privacy, terms, refunds, newsletter unsubscribe) is one
// source rendered inside whichever site's chrome the request came in on, so a buyer mid-checkout on
// the NOS host reads the legal pages without leaving the show site. Reading the host makes these
// routes dynamic; they are small. On NOS the pages sit inside the same `.nos-theme` scope as the
// show pages.
export async function generateMetadata(): Promise<Metadata> {
  const site = await requestSite();
  if (site === 'nos') return { ...buildSiteMetadata(nosOrigin(), SHOW_TITLE), title: NOS_TITLE };
  return buildSiteMetadata(saocOrigin());
}

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const site = await requestSite();
  if (site === 'nos') {
    // Dynamic import: a static one ships the NOS faces and stylesheets to every SAOC route (F1e).
    const { NosThemedFrame } = await import('@/components/site-chrome/NosThemedFrame');
    return <NosThemedFrame>{children}</NosThemedFrame>;
  }
  return <SaocFrame>{children}</SaocFrame>;
}
