import type { MetadataRoute } from 'next';

import { sanityFetch } from '@/sanity/lib/fetch';
import { societySlugsQuery, eventSlugsQuery, pastShowsQuery } from '@/sanity/queries';
import { mergePastShows, type SanityShowProjection } from '@/lib/data/mergeShows';
import { PAST_SHOWS_HREF, hasPastShowRecords } from '@/lib/data/past-shows';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import routeManifest from '@/content/national-show-routes.json';
import { nosPath } from '@/lib/nos-paths';
import { SAOC_STATIC_ROUTES } from '@/lib/saoc-sitemap-routes';
import { requestSite } from '@/lib/request-site';
import { nosOrigin, saocOrigin } from '@/lib/site-hosts';

// nos-site-split F1: the sitemap is per host. The NOS host lists only the show (its public paths
// have the /national-show prefix stripped, see lib/nos-paths.ts); the SAOC host lists the SAOC pages,
// societies and events and no show entries. Reading the host makes this route dynamic.
//
// F12/RM2 (national-show-ia-alignment, M4) — the show block of the NOS sitemap
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
// The SAOC static pages come from lib/saoc-sitemap-routes.ts, which a contract check guards
// against route-tree drift.
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

function buildNationalShowChildRoutes(baseUrl: string, showPastShows: boolean): MetadataRoute.Sitemap {
  const manifest = routeManifest as NosRouteManifest;
  return manifest.routes
    .filter((route) => route.indexable && !route.dynamic)
    .filter((route) => showPastShows || route.slug !== PAST_SHOWS_HREF)
    .map((route) => ({
      url: `${baseUrl}${nosPath(route.slug)}`,
      lastModified: new Date(),
      changeFrequency: changeFrequencyFor(route.archetype),
      priority: priorityFor(route.archetype),
    }));
}

async function buildNosSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = nosOrigin();
  const pastShowsRaw = await sanityFetch<SanityShowProjection[]>({
    query: pastShowsQuery,
    tags: ['show', 'sanity'],
  });

  // A public build lists neither the Past shows page nor its years until a past show with recorded
  // facts exists (the page answers 404 until then); a preview build lists them as before.
  const showPastShows = !withholdPlaceholderProse() || hasPastShowRecords(pastShowsRaw);

  // Sourced from Sanity (+ the static archive fallback), never hardcoded — see
  // lib/data/mergeShows.ts, the same union-on-year merge the archive pages themselves
  // read, so the sitemap can never list a year the archive doesn't actually render.
  const archiveYearRoutes: MetadataRoute.Sitemap = (
    showPastShows ? mergePastShows(pastShowsRaw) : []
  ).map((show) => ({
    url: `${baseUrl}${nosPath(`/national-show/archive/${show.year}`)}`,
    lastModified: new Date(),
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));

  return [...buildNationalShowChildRoutes(baseUrl, showPastShows), ...archiveYearRoutes];
}

async function buildSaocSitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = saocOrigin();
  const [societies, events] = await Promise.all([
    sanityFetch<{ slug: string }[]>({ query: societySlugsQuery, tags: ['society'] }),
    sanityFetch<{ slug: string }[]>({ query: eventSlugsQuery, tags: ['societyEvent'] }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = SAOC_STATIC_ROUTES.map((route) => ({
    url: `${baseUrl}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const societyRoutes: MetadataRoute.Sitemap = (societies ?? []).map((s) => ({
    url: `${baseUrl}/societies/${s.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const eventRoutes: MetadataRoute.Sitemap = (events ?? []).map((e) => ({
    url: `${baseUrl}/events/${e.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...societyRoutes, ...eventRoutes];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return (await requestSite()) === 'nos' ? buildNosSitemap() : buildSaocSitemap();
}
