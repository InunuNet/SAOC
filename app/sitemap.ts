import type { MetadataRoute } from 'next';

import { sanityFetch } from '@/sanity/lib/fetch';
import { societySlugsQuery, eventSlugsQuery } from '@/sanity/queries';

const BASE_URL = 'https://saoc.co.za';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [societies, events] = await Promise.all([
    sanityFetch<{ slug: string }[]>({ query: societySlugsQuery, tags: ['society'] }),
    sanityFetch<{ slug: string }[]>({ query: eventSlugsQuery, tags: ['societyEvent'] }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/societies`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/judging`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/national-show`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    {
      url: `${BASE_URL}/national-show/upcoming`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/national-show/archive`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];

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

  return [...staticRoutes, ...societyRoutes, ...eventRoutes];
}
