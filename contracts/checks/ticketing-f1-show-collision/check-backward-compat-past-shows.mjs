#!/usr/bin/env node
// Behavioural, per-surface backward-compatibility proof (2026-08-16 weak-assertion
// audit rule: one assertion per enumerated query surface, not one blanket claim).
// Runs BOTH real GROQ queries that fetch _type == "show" (README's step-2 enumeration)
// against the live dataset, read-only, and confirms each still returns exactly the 5
// pre-existing 'status == past' documents after F1's schema extension.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f1-show-collision/check-backward-compat-past-shows.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local — read-only.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const expected = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      '../../golden/ticketing-f1-show-collision/expected-past-show-ids.json'
    ),
    'utf8'
  )
).ids;

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN in .env.local'
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

const failures = [];

function assertSameIds(surfaceName, ids) {
  const got = [...ids].sort();
  const want = [...expected].sort();
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    failures.push(
      `${surfaceName}: expected ids ${JSON.stringify(want)}, got ${JSON.stringify(got)}`
    );
  }
}

// Surface 1: sanity/queries.ts pastShowsQuery (consumed by 3 marketing pages via
// lib/data/mergeShows.ts).
try {
  const docs = await client.fetch(
    `*[_type == "show" && status == "past"] | order(year desc){_id}`
  );
  assertSameIds('sanity/queries.ts pastShowsQuery', docs.map((d) => d._id));
} catch (err) {
  console.error(`FAIL: pastShowsQuery threw — ${err.message}`);
  process.exit(1);
}

// Surface 2: scripts/refresh-llms.ts inline query.
try {
  const docs = await client.fetch(
    `*[_type == "show" && status == "past"] | order(year desc)[0..4]{_id}`
  );
  assertSameIds('scripts/refresh-llms.ts', docs.map((d) => d._id));
} catch (err) {
  console.error(`FAIL: scripts/refresh-llms.ts query threw — ${err.message}`);
  process.exit(1);
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: both pre-existing show query surfaces still return exactly the 5 known past shows.');
process.exit(0);
