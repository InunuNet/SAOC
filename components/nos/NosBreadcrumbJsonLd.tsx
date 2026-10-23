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
import { NOS_INTERNAL_PREFIX as ROOT, nosPath } from '@/lib/nos-paths';

export interface NosBreadcrumbJsonLdProps {
  /** nav-config label by href, for hrefs under /national-show. */
  labels: Readonly<Record<string, string>>;
  /** The NOS origin, passed from the server layout so server and client render the same URL. */
  origin: string;
}

export function NosBreadcrumbJsonLd({ labels, origin }: NosBreadcrumbJsonLdProps) {
  // On the NOS host the browser path is clean (`/faq`) while labels are keyed by the internal
  // `/national-show/faq` href; accept either form.
  const rawPathname = usePathname() ?? ROOT;
  const pathname =
    rawPathname === ROOT || rawPathname.startsWith(`${ROOT}/`)
      ? rawPathname
      : `${ROOT}${rawPathname === '/' ? '' : rawPathname}`;
  const segments = pathname.slice(ROOT.length).split('/').filter(Boolean);

  const trail: { name: string; url: string }[] = [];
  let href = ROOT;
  for (let depth = 0; depth <= segments.length; depth += 1) {
    if (depth > 0) href = `${href}/${segments[depth - 1]}`;
    const name = labels[href];
    if (!name) break;
    trail.push({ name, url: `${origin}${nosPath(href)}` });
  }
  if (trail.length === 0) return null;

  return <JsonLd data={breadcrumbJsonLd(trail)} />;
}
