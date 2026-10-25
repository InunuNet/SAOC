// Shared by the F9 rendered checks (architect input, never edited by @dev).
import { get } from './_server.mjs';

// The National Show event slug, read the way f5-event-detail-rendered.mjs does (listing + sitemap).
export async function findEventSlugs(port) {
  const listing = await get(port, '/events', 'localhost');
  const sitemap = await get(port, '/sitemap.xml', 'localhost');
  const slugs = [...new Set([
    ...[...listing.body.matchAll(/href="\/events\/([a-z0-9-]+)"/g)].map((m) => m[1]),
    ...[...sitemap.body.matchAll(/\/events\/([a-z0-9-]+)<\/loc>/g)].map((m) => m[1]),
  ])].filter((s) => s !== 'submit');
  const showSlug = slugs.find((s) => /national-(orchid|show)|south-african-national/.test(s));
  return { slugs, showSlug, otherSlug: slugs.find((s) => s !== showSlug) };
}
