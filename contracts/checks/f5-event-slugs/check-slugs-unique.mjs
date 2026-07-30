#!/usr/bin/env node
// F5 (cms-activation-deploy): slugs must be UNIQUE across the collection. This is the
// assertion that actually catches the collision case the mission flagged — a
// title-only slug is not guaranteed unique (an annual show recurring next year would
// produce the same base slug), and eventBySlugQuery's `*[_type == "societyEvent" &&
// slug.current == $slug][0]` silently returns whichever match GROQ's unordered [0]
// happens to pick if two documents ever share a slug — the exact "wrong page renders"
// failure mode F3 already fixed for the six page singletons.
//
// Requires every document to have a non-empty slug FIRST (a hard fail, not a skip —
// uniqueness among a partially-null set is not a meaningful check).
//
// Run as: node --import tsx/esm contracts/checks/f5-event-slugs/check-slugs-unique.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
// Exit codes: 0 = all slugs present and unique. 1 = any missing slug, any duplicate,
// or any infrastructure failure.

import { getClientOrFail, fetchAllEvents } from './_shared.mjs';

const client = getClientOrFail();
const events = await fetchAllEvents(client);

if (events.length === 0) {
  console.error('FAIL: 0 societyEvent documents found — expected 18 (or a real, non-zero count)');
  process.exit(1);
}

const missing = events.filter((e) => typeof e.slug !== 'string' || e.slug.trim().length === 0);
if (missing.length > 0) {
  missing.forEach((e) => console.error(`FAIL: ${e._id} ("${e.title}"): slug is missing/empty — cannot check uniqueness of an incomplete set`));
  console.error(`\n${missing.length} of ${events.length} documents have no slug.`);
  process.exit(1);
}

const bySlug = new Map();
for (const e of events) {
  const list = bySlug.get(e.slug) ?? [];
  list.push(e._id);
  bySlug.set(e.slug, list);
}

const duplicates = [...bySlug.entries()].filter(([, ids]) => ids.length > 1);

console.log(`Checked ${events.length} societyEvent documents, ${bySlug.size} distinct slugs.`);

if (duplicates.length > 0) {
  duplicates.forEach(([slug, ids]) => console.error(`FAIL: slug "${slug}" is shared by ${ids.length} documents — ${ids.join(', ')}`));
  console.error(`\n${duplicates.length} duplicate slug(s) found.`);
  process.exit(1);
}

console.log(`PASS: all ${events.length} slugs are unique.`);
process.exit(0);
