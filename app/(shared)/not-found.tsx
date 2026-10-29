import type { Metadata } from 'next';

import {
  NosPageNotFound,
  metadata as nosNotFoundMetadata,
} from '@/app/(nos)/national-show/not-found';
import { NotFoundSection, saocNotFoundMetadata } from '@/components/site-chrome/SaocNotFound';
import { requestSite } from '@/lib/request-site';
import { SHOW_TITLE } from '@/lib/show-title';

// A notFound() from the shared tree (/newsletter/<unknown>) renders inside app/(shared)/layout.tsx,
// which already owns the host's chrome and, on NOS, the theme scope, so the section goes in bare.
// This is the only not-found that reads the request host: the shared layout is already dynamic, and
// a group-level not-found only enters this group's own tree.
export async function generateMetadata(): Promise<Metadata> {
  if ((await requestSite()) !== 'nos') return saocNotFoundMetadata;
  return { ...nosNotFoundMetadata, title: { absolute: `Page not found | ${SHOW_TITLE}` } };
}

export default async function SharedNotFound() {
  return (await requestSite()) === 'nos' ? <NosPageNotFound /> : <NotFoundSection />;
}
