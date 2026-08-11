#!/usr/bin/env node
// F1 (saoc-pages-editable): live-state proof that homePage.heroImages is no longer
// missing `_key` on its array items. This is the exact condition Sanity Studio's
// "Missing keys" banner locks on — every item in a document array needs a unique,
// non-empty `_key` string, or the Studio refuses inline editing of that array.
//
// Verified BEFORE any fix (2026-08-11, architect dry run against the live dataset):
//   heroImages had 4 items, none carrying a `_key` field at all (undefined, not just
//   null) — this script's own JSON dump below was captured from that run and is also
//   preserved in contracts/golden/f1-hero-keys/pre-fix-live-state.json for the record.
//
// Run as: node --import tsx/esm contracts/checks/f1-hero-keys/check-hero-keys-live.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
//
// Exit codes: 0 = homePage exists, heroImages has >=1 item, every item has a unique
// non-empty string `_key` and a well-formed image asset reference. 1 = any of that is
// false, or the document/credentials are missing — never a silent skip.

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

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

const failures = [];

let doc;
try {
  doc = await client.fetch(`*[_id == "homePage"][0]{_id, heroImages}`);
} catch (err) {
  console.error(`FAIL: GROQ query for homePage threw — ${err.message}`);
  process.exit(1);
}

if (!doc) {
  console.error('FAIL: homePage document does not exist at the pinned id "homePage"');
  process.exit(1);
}

const heroImages = doc.heroImages;

if (!Array.isArray(heroImages) || heroImages.length === 0) {
  failures.push(`heroImages is missing or empty (got: ${JSON.stringify(heroImages)})`);
} else {
  const seenKeys = new Set();
  heroImages.forEach((item, i) => {
    const key = item?._key;
    if (typeof key !== 'string' || key.length === 0) {
      failures.push(`heroImages[${i}] has no non-empty string _key (got: ${JSON.stringify(key)})`);
    } else if (seenKeys.has(key)) {
      failures.push(`heroImages[${i}] has a duplicate _key "${key}"`);
    } else {
      seenKeys.add(key);
    }

    const ref = item?.asset?._ref;
    if (typeof ref !== 'string' || !/^image-/.test(ref)) {
      failures.push(`heroImages[${i}] has no well-formed asset reference (got: ${JSON.stringify(item?.asset)})`);
    }
  });
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(`PASS: homePage.heroImages has ${heroImages.length} item(s), each with a unique _key and a well-formed asset reference.`);
process.exit(0);
