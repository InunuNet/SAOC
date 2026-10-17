// =============================================================
// NOS — components/nos/NosBreadcrumbJsonLd.tsx
// Client Component. The one BreadcrumbList node for every page under /national-show, mounted once by
// national-show/layout.tsx, which passes the nav-config label of each href. The trail starts at
// National Show and follows the page's ancestors for as long as each carries a nav-config label;
// a segment with no label (a dynamic child, vendors/apply) ends it rather than being invented.
// =============================================================
'use client';

import { usePathname } from 'next/navigation';

import { JsonLd, breadcrumbJsonLd } from '@/components/seo/JsonLd';

const ORIGIN = 'https://saoc.co.za';
const ROOT = '/national-show';

export interface NosBreadcrumbJsonLdProps {
  /** nav-config label by href, for hrefs under /national-show. */
  labels: Readonly<Record<string, string>>;
}

export function NosBreadcrumbJsonLd({ labels }: NosBreadcrumbJsonLdProps) {
  const pathname = usePathname() ?? ROOT;
  const segments = pathname.slice(ROOT.length).split('/').filter(Boolean);

  const trail: { name: string; url: string }[] = [];
  let href = ROOT;
  for (let depth = 0; depth <= segments.length; depth += 1) {
    if (depth > 0) href = `${href}/${segments[depth - 1]}`;
    const name = labels[href];
    if (!name) break;
    trail.push({ name, url: `${ORIGIN}${href}` });
  }
  if (trail.length === 0) return null;

  return <JsonLd data={breadcrumbJsonLd(trail)} />;
}
