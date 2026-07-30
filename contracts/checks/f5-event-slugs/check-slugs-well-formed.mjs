#!/usr/bin/env node
// F5 (cms-activation-deploy): every societyEvent document must have a non-empty,
// well-formed slug — lowercase kebab-case, no leading/trailing/double hyphens,
// [a-z0-9] and single hyphens only. Confirms the field type matches what the front
// end reads (sanity/queries.ts selects "slug": slug.current — a plain string
// projection off the standard Sanity `slug` object type, confirmed against
// sanity/schemas/documents/event.ts).
//
// Run as: node --import tsx/esm contracts/checks/f5-event-slugs/check-slugs-well-formed.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
// Exit codes: 0 = all 18 (or however many exist) have a well-formed slug. 1 = any
// missing/malformed slug, or any infrastructure failure — never a silent skip.

import { getClientOrFail, fetchAllEvents } from './_shared.mjs';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const client = getClientOrFail();
const events = await fetchAllEvents(client);

if (events.length === 0) {
  console.error('FAIL: 0 societyEvent documents found — expected 18 (or a real, non-zero count)');
  process.exit(1);
}

const failures = [];
for (const e of events) {
  if (typeof e.slug !== 'string' || e.slug.trim().length === 0) {
    failures.push(`${e._id} ("${e.title}"): slug is missing/empty`);
    continue;
  }
  if (!SLUG_RE.test(e.slug)) {
    failures.push(`${e._id} ("${e.title}"): slug "${e.slug}" is not well-formed kebab-case`);
  }
}

console.log(`Checked ${events.length} societyEvent documents.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} of ${events.length} documents failed.`);
  process.exit(1);
}

console.log(`PASS: all ${events.length} documents have a well-formed slug.`);
process.exit(0);
