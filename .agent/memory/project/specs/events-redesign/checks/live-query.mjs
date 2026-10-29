// events-redesign root cause, proven against the live dataset (public read, project 26yfbug4 / production, read-only GET).
// The 19th National Show's societyEvent holds the DATE-ONLY values 2027-09-23 / 2027-09-26; GROQ dateTime() returns null for those, so
// the old filter dropped the real show from /events and the home "What's on" strip. This runs the query text exactly as committed in
// sanity/queries.ts (upcomingEventsQuery) with the params from lib/sast-date.ts and requires the show in the result.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { finish, readRepoFile, repoRoot } from './_lib.mjs';

const failures = [];
const src = readRepoFile('sanity/queries.ts') ?? '';
const m = src.match(/export const upcomingEventsQuery = defineQuery\(`([\s\S]*?)`\);/);
if (!m) failures.push('upcomingEventsQuery not found in sanity/queries.ts');
else {
  const S = await import(pathToFileURL(path.join(repoRoot, 'lib/sast-date.ts')).href);
  const params = S.upcomingEventsParams(new Date());
  const qs = new URLSearchParams({ query: m[1] });
  for (const [k, v] of Object.entries(params)) qs.set(`$${k}`, JSON.stringify(v));
  const url = `https://26yfbug4.api.sanity.io/v2024-10-01/data/query/production?${qs}`;
  let res;
  try { res = await fetch(url); } catch (e) { failures.push(`INFRA: Sanity unreachable: ${e.message}`); }
  if (res) {
    const body = await res.json();
    if (!res.ok) failures.push(`INFRA: Sanity ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
    else {
      const titles = (body.result ?? []).map((e) => e.title);
      if (!titles.some((t) => /19th South African National Orchid Show/i.test(t))) failures.push(`the 19th National Show is missing from the upcoming-events query result (got ${JSON.stringify(titles)})`);
      for (const e of body.result ?? []) if (!e.slug) failures.push(`event "${e.title}" has no slug in the query result`);
    }
  }
}
finish('live-query.mjs', failures, 'the live upcoming-events query returns the 19th National Show.');
