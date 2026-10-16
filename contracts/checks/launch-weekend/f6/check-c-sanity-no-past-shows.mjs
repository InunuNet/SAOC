#!/usr/bin/env node
// A3 - anonymous read of the production dataset: no published past `show` doc, and none of the five invented ids;
// the 2027 show is untouched.
import { golden, report } from './_lib.mjs';

const q = encodeURIComponent('*[_type=="show" && !(_id in path("drafts.**"))]{_id,status,entries,location}');
let json;
try {
  const res = await fetch(`https://26yfbug4.api.sanity.io/v2024-01-01/data/query/production?query=${q}`);
  json = await res.json();
} catch (e) { console.error(`INFRA: Sanity unreachable (${e.message})`); process.exit(2); }
if (!Array.isArray(json.result)) { console.error('INFRA: unexpected Sanity response'); process.exit(2); }
const problems = [];
const ids = new Set(golden.sanityUnpublish.map((d) => d.id));
for (const d of json.result) {
  if (d.status === 'past') problems.push(`published past show remains: ${d._id}`);
  if (ids.has(d._id)) problems.push(`invented show still published: ${d._id}`);
}
if (!json.result.some((d) => d._id === 'show-19-2027')) problems.push('show-19-2027 is missing (must be kept)');
report(problems, `${json.result.length} published show doc(s), none past, none invented`);
