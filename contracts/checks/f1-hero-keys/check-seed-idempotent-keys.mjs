#!/usr/bin/env node
// F1 (saoc-pages-editable): proves the CODE half of the fix — running
// scripts/seed-page-singletons.ts must (a) actually repair the live
// homePage.heroImages document (this is how the DATA half gets fixed: by running the
// corrected script, not by a manual Studio click) and (b) never regress on a later
// reseed. A reseed that regenerated a fresh `_key` on every run, or dropped one, would
// re-trigger Sanity's "Missing keys" lock the moment content drifted — so `_key`
// stability across runs is not cosmetic, it is the actual regression this feature
// exists to prevent ("a reseed can never reintroduce this", per the mission brief).
//
// This is a real integration run (writes to the live dataset via the same
// createOrReplace path Studio would use), not a mock — matching this repo's existing
// f4-seed-page-singletons checks, which also seed for real rather than stub the
// client.
//
// Run as: node --import tsx/esm contracts/checks/f1-hero-keys/check-seed-idempotent-keys.mjs
// Requires SANITY_API_TOKEN (write-enabled) in .env.local, and must run from the repo
// root (the seed script resolves public/images/ and .env.local relative to cwd).
//
// Exit codes: 0 = two consecutive seed runs both leave heroImages with 4 valid,
// unique `_key`s, and the second run's keys + asset refs are byte-identical to the
// first run's (proves the reuse path backfills/preserves keys instead of
// regenerating them or re-uploading duplicate assets). 1 = any of that is false, the
// seed script itself exits non-zero, or credentials are missing.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createClient } from '@sanity/client';
import { config } from 'dotenv';

const execFileAsync = promisify(execFile);

config({ path: '.env.local', quiet: true });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN in .env.local',
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

async function runSeed() {
  try {
    await execFileAsync('node', ['--import', 'tsx/esm', 'scripts/seed-page-singletons.ts'], {
      cwd: process.cwd(),
    });
  } catch (err) {
    console.error(`FAIL: scripts/seed-page-singletons.ts exited non-zero — ${err.stderr || err.message}`);
    process.exit(1);
  }
}

function extractHeroSignature(doc) {
  const heroImages = doc?.heroImages;
  if (!Array.isArray(heroImages) || heroImages.length === 0) {
    return null;
  }
  return heroImages.map((item) => ({ key: item?._key, ref: item?.asset?._ref }));
}

async function fetchHeroSignature() {
  const doc = await client.fetch(`*[_id == "homePage"][0]{heroImages}`);
  return extractHeroSignature(doc);
}

const failures = [];

await runSeed();
const first = await fetchHeroSignature();

if (!first) {
  console.error('FAIL: homePage.heroImages missing or empty after first seed run');
  process.exit(1);
}

const seenKeys = new Set();
first.forEach((item, i) => {
  if (typeof item.key !== 'string' || item.key.length === 0) {
    failures.push(`first run: heroImages[${i}] has no non-empty string _key`);
  } else if (seenKeys.has(item.key)) {
    failures.push(`first run: heroImages[${i}] has a duplicate _key "${item.key}"`);
  } else {
    seenKeys.add(item.key);
  }
});

await runSeed();
const second = await fetchHeroSignature();

if (!second) {
  console.error('FAIL: homePage.heroImages missing or empty after second seed run');
  process.exit(1);
}

if (JSON.stringify(first) !== JSON.stringify(second)) {
  failures.push(
    `_key/asset signature changed between consecutive seed runs — reuse path is regenerating instead of preserving.\n  run 1: ${JSON.stringify(first)}\n  run 2: ${JSON.stringify(second)}`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  `PASS: two consecutive seed runs both leave heroImages with ${first.length} valid unique _key(s), identical across runs.`,
);
process.exit(0);
