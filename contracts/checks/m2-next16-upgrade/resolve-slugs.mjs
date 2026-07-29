#!/usr/bin/env node
// Resolves real dynamic-route params (a society slug, an event slug, a
// national-show archive year) live against the Sanity dataset, instead of
// hardcoding values that can go stale as content changes. Reads
// NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET from the
// environment (loaded from .env.local by the caller). Prints JSON to
// stdout: { societySlug, eventSlug, archiveYear }. Any field the query
// can't resolve is null — callers must skip that route rather than fail
// the whole battery on empty content, since content population (F6) is
// explicitly out of scope for this mission.
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2024-10-01';

if (!projectId) {
  console.error('NEXT_PUBLIC_SANITY_PROJECT_ID not set — cannot resolve slugs');
  process.exit(1);
}

async function groq(query) {
  const url = `https://${projectId}.apicdn.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Sanity query failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.result;
}

const [societySlug, eventSlug, archiveYear] = await Promise.all([
  groq('*[_type == "society" && defined(slug.current)][0].slug.current'),
  groq('*[_type == "societyEvent" && defined(slug.current)][0].slug.current'),
  groq('*[_type == "nationalShow" && defined(year)] | order(year desc)[0].year'),
]);

console.log(JSON.stringify({ societySlug, eventSlug, archiveYear }));
