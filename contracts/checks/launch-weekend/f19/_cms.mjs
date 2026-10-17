// Read-only Sanity access for the F19 checks (published documents only; never writes).
import { ROOT } from './_lib.mjs';

export async function publishedUpcomingEvents() {
  const { createClient } = await import('@sanity/client');
  const c = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: process.env.NEXT_PUBLIC_SANITY_DATASET,
    apiVersion: '2024-01-01', token: process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN, useCdn: false,
  });
  const q = '*[_type == "societyEvent" && date >= now() && !(_id in path("drafts.**"))]{_id, title, date, "slug": slug.current}';
  const all = await c.fetch('count(*[_type == "societyEvent"])');
  return { published: await c.fetch(q), totalDocs: all, root: ROOT };
}
