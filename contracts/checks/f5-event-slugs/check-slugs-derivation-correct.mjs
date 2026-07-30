#!/usr/bin/env node
// F5 (cms-activation-deploy): every seeded slug must match the canonical derivation
// in _slugify.mjs — recomputes expected slugs from the live (title, date) pairs using
// the exact same algorithm @dev's seeding script must use, and exact-compares against
// what was actually written. This is what turns "a slug exists" into "the RIGHT slug
// exists" — a script that slugified differently (e.g. kept stopwords differently,
// didn't strip the em dash, or resolved collisions some other way) would pass A1/A2
// (well-formed, unique) but fail here.
//
// Also cross-checks against contracts/golden/f5-event-slugs/expected-slugs.golden.json
// (the values @architect independently pre-computed and verified against the seed
// data's own _id-embedded slug hints) as a second, static source of truth — catches
// the case where _slugify.mjs itself was edited after the golden was written.
//
// Run as: node --import tsx/esm contracts/checks/f5-event-slugs/check-slugs-derivation-correct.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
// Exit codes: 0 = every actual slug matches both the live re-derivation and the
// static golden. 1 = any mismatch, any missing slug, or any infrastructure failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { getClientOrFail, fetchAllEvents } from './_shared.mjs';
import { deriveSlugs } from './_slugify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_PATH = path.resolve(__dirname, '../../golden/f5-event-slugs/expected-slugs.golden.json');

const client = getClientOrFail();
const events = await fetchAllEvents(client);

if (events.length === 0) {
  console.error('FAIL: 0 societyEvent documents found — expected 18 (or a real, non-zero count)');
  process.exit(1);
}

let golden;
try {
  golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8'));
} catch (err) {
  console.error(`FAIL: could not read golden file ${GOLDEN_PATH} — ${err.message}`);
  process.exit(1);
}
const goldenBySlug = new Map(golden.documents.map((d) => [d._id, d.expectedSlug]));

const failures = [];

// Live re-derivation: treats every document as unslugged and recomputes from
// scratch, in the canonical (date, _id) order. Correct if @dev's script only ever
// assigns to null-slug documents (idempotent, per _slugify.mjs's contract) — running
// it against a fully-seeded set should reproduce exactly what's already there.
const rederived = deriveSlugs(events.map((e) => ({ id: e._id, title: e.title, date: e.date })));

for (const e of events) {
  if (typeof e.slug !== 'string' || e.slug.trim().length === 0) {
    failures.push(`${e._id} ("${e.title}"): slug is missing/empty — cannot verify derivation`);
    continue;
  }

  const expectedLive = rederived.get(e._id);
  if (e.slug !== expectedLive) {
    failures.push(
      `${e._id} ("${e.title}"): actual slug "${e.slug}" does not match live re-derivation "${expectedLive}"`
    );
  }

  if (goldenBySlug.has(e._id)) {
    const expectedGolden = goldenBySlug.get(e._id);
    if (e.slug !== expectedGolden) {
      failures.push(
        `${e._id} ("${e.title}"): actual slug "${e.slug}" does not match static golden "${expectedGolden}"`
      );
    }
  } else {
    failures.push(`${e._id} ("${e.title}"): no entry in the golden file — golden is stale, update it`);
  }
}

console.log(`Checked ${events.length} societyEvent documents against derivation + golden.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} of ${events.length} documents failed.`);
  process.exit(1);
}

console.log(`PASS: all ${events.length} slugs match the canonical derivation and the golden file.`);
process.exit(0);
