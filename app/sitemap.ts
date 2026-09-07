import type { MetadataRoute } from 'next';

import { sanityFetch } from '@/sanity/lib/fetch';
import { societySlugsQuery, eventSlugsQuery, pastShowsQuery } from '@/sanity/queries';
import { mergePastShows, type SanityShowProjection } from '@/lib/data/mergeShows';

const BASE_URL = 'https://saoc.co.za';

// F18 (nos-design-system, M6) — fixed a live crawl-budget defect: the "upcoming" child
// route under /national-show is an intentional 308 permanent redirect (see its own
// page.tsx) and must never be advertised in the sitemap, so it is deliberately absent
// from this list. This list also fills in every other /national-show/* child route that
// was previously missing entirely — see goldens/m6-conversion-seo-social.golden.md B.1.
// Deliberately excludes the token-gated `vendors/register` and `vendors/payment` routes
// (noindex, not public content) and the F19 social-kit route (noindex, tooling only).
const NATIONAL_SHOW_CHILD_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/national-show/plan-your-visit', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/national-show/what-to-expect', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/national-show/faq', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/national-show/exhibitors', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/national-show/tickets', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/national-show/vendors', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/national-show/vendors/apply', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/national-show/workshops', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/national-show/conferences', changeFrequency: 'weekly', priority: 0.6 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [societies, events, pastShowsRaw] = await Promise.all([
    sanityFetch<{ slug: string }[]>({ query: societySlugsQuery, tags: ['society'] }),
    sanityFetch<{ slug: string }[]>({ query: eventSlugsQuery, tags: ['societyEvent'] }),
    sanityFetch<SanityShowProjection[]>({ query: pastShowsQuery, tags: ['show', 'sanity'] }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/societies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/judging`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/national-show`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${BASE_URL}/national-show/archive`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];

  const nationalShowChildRoutes: MetadataRoute.Sitemap = NATIONAL_SHOW_CHILD_ROUTES.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Sourced from Sanity (+ the static archive fallback), never hardcoded — see
  // lib/data/mergeShows.ts, the same union-on-year merge the archive pages themselves
  // read, so the sitemap can never list a year the archive doesn't actually render.
  const archiveYearRoutes: MetadataRoute.Sitemap = mergePastShows(pastShowsRaw).map((show) => ({
    url: `${BASE_URL}/national-show/archive/${show.year}`,
    lastModified: new Date(),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  const societyRoutes: MetadataRoute.Sitemap = (societies ?? []).map((s) => ({
    url: `${BASE_URL}/societies/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${BASE_URL}/events/${e.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    ...staticRoutes,
    ...nationalShowChildRoutes,
    ...archiveYearRoutes,
    ...societyRoutes,
    ...eventRoutes,
  ];
}
