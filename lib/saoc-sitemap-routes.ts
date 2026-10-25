import type { MetadataRoute } from 'next';

export interface SaocStaticRoute {
  // Site-relative path; the home page is the empty string.
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}

// Public static pages on the SAOC host. Deliberately absent: /events/submit (members-only,
// noindex), /media-kit (gated) and /newsletter/unsubscribe (token utility page). Dynamic
// /societies/[slug] and /events/[slug] entries come from Sanity in app/sitemap.ts.
export const SAOC_STATIC_ROUTES: ReadonlyArray<SaocStaticRoute> = [
  { path: '', changeFrequency: 'weekly', priority: 1 },
  { path: '/about', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/societies', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/judging', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/events', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/contact', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/sponsors', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/memorandum-of-incorporation', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refunds', changeFrequency: 'yearly', priority: 0.3 },
];
