import type { Metadata } from 'next';

import { SaocFrame } from '@/components/site-chrome/SaocFrame';
import { saocOrigin } from '@/lib/site-hosts';
import { buildSiteMetadata } from '@/lib/site-metadata';

// nos-site-split F1: this group is the SAOC site only (the show tree lives in app/(nos), the
// host-neutral legal pages in app/(shared)). Chrome, metadata and the Organization JSON-LD are the
// SAOC site's own, and metadataBase is the SAOC origin.
export function generateMetadata(): Metadata {
  return buildSiteMetadata(saocOrigin());
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SaocFrame>{children}</SaocFrame>;
}
