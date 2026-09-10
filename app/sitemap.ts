import type { MetadataRoute } from 'next';

import { sanityFetch } from '@/sanity/lib/fetch';
import { societySlugsQuery, eventSlugsQuery, pastShowsQuery } from '@/sanity/queries';
import { mergePastShows, type SanityShowProjection } from '@/lib/data/mergeShows';
import routeManifest from '@/content/national-show-routes.json';

const BASE_URL = 'https://saoc.co.za';

// F12/RM2 (national-show-ia-alignment, M4) — the /national-show/* block of this sitemap
// is DERIVED from content/national-show-routes.json, the artifact the saoc-eb lane also
// builds its header from. A hand-kept list drifts silently: this file previously listed a
// route since deleted from the tree, and omitted seven real routes entirely. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/route-manifest.golden.md §10.
//
// Every `indexable: true`, non-dynamic row becomes an entry; every `indexable: false`
// row (the token-gated vendor register/payment routes) does not. The dynamic
// `/national-show/archive/[year]` row is excluded here and handled by
// `archiveYearRoutes` below, which enumerates real years from Sanity — a template slug
// with a literal `[year]` segment is not a URL.
//
// SCOPED TO THIS BLOCK ONLY: staticRoutes (the SAOC pages) and the Sanity
// society/event blocks below are untouched — they belong to the other lane.
interface NosManifestRoute {
  slug: string;
  indexable: boolean;
  dynamic: boolean;
  archetype: string;
}
interface NosRouteManifest {
  routes: NosManifestRoute[];
}

function changeFrequencyFor(archetype: string): MetadataRoute.Sitemap[number]['changeFrequency'] {
  if (archetype === 'transactional') return 'weekly';
  if (archetype === 'hub') return 'weekly';
  return 'monthly';
}

function priorityFor(archetype: string): number {
  if (archetype === 'hub') return 0.8;
  if (archetype === 'transactional') return 0.7;
  if (archetype === 'listing' || archetype === 'schedule') return 0.6;
  return 0.5;
}

function buildNationalShowChildRoutes(): MetadataRoute.Sitemap {
  const manifest = routeManifest as NosRouteManifest;
  return manifest.routes
    .filter((route) => route.indexable && !route.dynamic)
    .map((route) => ({
      url: `${BASE_URL}${route.slug}`,
      lastModified: new Date(),
      changeFrequency: changeFrequencyFor(route.archetype),
      priority: priorityFor(route.archetype),
    }));
}

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
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];

  const nationalShowChildRoutes: MetadataRoute.Sitemap = buildNationalShowChildRoutes();

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
