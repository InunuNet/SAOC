import type { MetadataRoute } from 'next';

type SitemapItem = MetadataRoute.Sitemap[number];

type SitemapMeta = {
  changeFrequency: SitemapItem['changeFrequency'];
  priority: number;
};

/**
 * One sitemap entry. `lastModified` is set only from a real source date (an ISO string that parses);
 * otherwise the key is omitted rather than stamped with the request time, which would claim every
 * page changed on every crawl.
 */
export function sitemapEntry(url: string, meta: SitemapMeta, updatedAt?: unknown): SitemapItem {
  const entry: SitemapItem = { url, changeFrequency: meta.changeFrequency, priority: meta.priority };
  if (typeof updatedAt !== 'string') return entry;
  const parsed = new Date(updatedAt);
  if (isNaN(parsed.getTime())) return entry;
  return { ...entry, lastModified: parsed };
}
