// societies-content F1 — READ-ONLY look at the live dataset after --apply: 21 listed, 16 hidden, nothing deleted, nothing else touched.
// Env is parsed straight from .env.local (no dotenv). The token is never printed. This check performs no writes.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createClient } from '@sanity/client';

const SPEC = '.agent/memory/project/specs/societies-content/goldens';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID, dataset: env.NEXT_PUBLIC_SANITY_DATASET, apiVersion: '2024-01-01',
  token: env.SANITY_API_READ_TOKEN || env.SANITY_API_TOKEN, useCdn: false, perspective: 'published',
});
const docs = await client.fetch('*[_type == "society"]{_id, name, "slug": slug.current, listed, contactEmail, meets, venue, driveSource}');
const want = JSON.parse(readFileSync(`${SPEC}/sanity-docs.json`, 'utf8'));
const disp = JSON.parse(readFileSync(`${SPEC}/disposition.json`, 'utf8'));
const listed = docs.filter((d) => d.listed !== false);
assert.deepEqual(listed.map((d) => d.slug).sort(), want.map((d) => d.slug.current).sort(), 'listed societies differ from the 21 in Lee-Ann\'s contact list');
assert.deepEqual(docs.filter((d) => d.listed === false).map((d) => d._id).sort(), disp.hide.map((h) => h._id).sort(), 'hidden set differs from the 16 hidden placeholders');
assert.equal(docs.length, 37, 'no society document may be deleted or added beyond 21 listed + 16 hidden');
for (const w of want) {
  const d = listed.find((x) => x.slug === w.slug.current);
  assert.equal(d.meets, w.meets, `${w.name}: meets`);
  assert.equal(d.venue, w.venue, `${w.name}: venue`);
  assert.equal(d.contactEmail ?? null, w.contactEmail, `${w.name}: contactEmail`);
}
console.log('PASS live (read-only): 21 listed match the docs, 16 hidden, 37 documents total');
