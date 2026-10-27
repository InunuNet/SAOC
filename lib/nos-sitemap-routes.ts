import type { MetadataRoute } from 'next';

export interface NosExtraStaticRoute {
  // Site-relative public NOS path.
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

// NOS pages the show route manifest (content/national-show-routes.json) does not carry. Deliberately
// absent: /privacy, /terms and /refunds, which are shared pages whose canonical is the SAOC host
// (proxy.ts SHARED_EXACT), so a NOS entry would be a non-canonical URL in the feed. They stay indexed
// through the SAOC sitemap (lib/saoc-sitemap-routes.ts).
export const NOS_EXTRA_STATIC_ROUTES: ReadonlyArray<NosExtraStaticRoute> = [
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
];

const TICKET_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * `/tickets/<slug>` paths for the given ticket slugs: de-duplicated and sorted, slugs that are not
 * URL-safe dropped silently. Callers pass the slugs of the cards the ticket listing shows, never every
 * ticketType document (some products are buyable but deliberately unlisted).
 */
export function nosTicketSlugPaths(slugs: readonly string[]): string[] {
  const valid = slugs.filter((slug) => TICKET_SLUG_PATTERN.test(slug));
  return [...new Set(valid)].sort().map((slug) => `/tickets/${slug}`);
}
