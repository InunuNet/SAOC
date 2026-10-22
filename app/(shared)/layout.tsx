import type { Metadata } from 'next';

import { NosFrame } from '@/components/site-chrome/NosFrame';
import { SaocFrame } from '@/components/site-chrome/SaocFrame';
import { NosThemeScope } from '@/components/nos/NosThemeScope';
import { requestSite } from '@/lib/request-site';
import { nosOrigin, saocOrigin } from '@/lib/site-hosts';
import { buildSiteMetadata } from '@/lib/site-metadata';

// nos-site-split F1: host-neutral content (privacy, terms, refunds, newsletter unsubscribe) is one
// source rendered inside whichever site's chrome the request came in on, so a buyer mid-checkout on
// the NOS host reads the legal pages without leaving the show site. Reading the host makes these
// routes dynamic; they are small. On NOS the pages sit inside the same `.nos-theme` scope as the
// show pages.
export async function generateMetadata(): Promise<Metadata> {
  const site = await requestSite();
  return buildSiteMetadata(site === 'nos' ? nosOrigin() : saocOrigin());
}

export default async function SharedLayout({ children }: { children: React.ReactNode }) {
  const site = await requestSite();
  if (site === 'nos') {
    return (
      <NosFrame>
        <NosThemeScope>{children}</NosThemeScope>
      </NosFrame>
    );
  }
  return <SaocFrame>{children}</SaocFrame>;
}
