import type { Metadata } from 'next';

import { NosFrame } from '@/components/site-chrome/NosFrame';
import { nosOrigin } from '@/lib/site-hosts';
import { NOS_TITLE, buildSiteMetadata } from '@/lib/site-metadata';

// nos-site-split F1: this group is the National Orchid Show site only (/national-show/**,
// /tickets/**, /vsp). It serves the NOS host, where proxy.ts rewrites the clean public paths onto
// these routes. Chrome is the NOS own-brand header and footer; metadataBase is the NOS origin.
// The `.nos-theme` scope is applied by the segment layouts (national-show, tickets, vsp).
export function generateMetadata(): Metadata {
  return { ...buildSiteMetadata(nosOrigin()), title: NOS_TITLE };
}

export default function NosLayout({ children }: { children: React.ReactNode }) {
  return <NosFrame>{children}</NosFrame>;
}
