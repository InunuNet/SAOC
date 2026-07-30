#!/usr/bin/env node
// F4 (cms-activation-deploy): guards against the seeding script itself creating a
// duplicate (e.g. re-run without an idempotency check, or a createOrReplace that
// silently no-ops into create). F3 already proved 0-or-1 documents is the invariant
// for these 6 pinned types before any content existed; this re-runs the identical
// check AFTER seeding, so a bug that inserts document #2 instead of writing to the
// pinned id is caught immediately rather than discovered later as "which one does the
// site render" (the exact failure mode F3's pinning exists to prevent in the Studio,
// but a script using the API directly bypasses the Studio's create-new filter and
// could still create a duplicate).
//
// Run as: node --import tsx/esm contracts/checks/f4-seed-page-singletons/check-no-duplicate-seeds.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
//
// Exit codes: 0 = every pinned type still has exactly 0 or 1 documents. 1 = any type
// has 2+, or the query itself fails — never a silent skip.

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const PINNED_TYPES = ['homePage', 'aboutPage', 'nationalShow', 'contactPage', 'judgingPage', 'membersPage'];

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error('FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN in .env.local');
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

const failures = [];

for (const typeName of PINNED_TYPES) {
  let docs;
  try {
    docs = await client.fetch(`*[_type == $t]{_id}`, { t: typeName });
  } catch (err) {
    console.error(`FAIL: GROQ query for ${typeName} threw — ${err.message}`);
    process.exit(1);
  }
  if (docs.length > 1) {
    failures.push(
      `${typeName}: ${docs.length} documents exist (ids: ${docs.map((d) => d._id).join(', ')}) — seeding created a duplicate instead of writing to the pinned id`
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: all 6 pinned types still have 0-1 documents after seeding.');
process.exit(0);
