#!/usr/bin/env node
/**
 * F5 (cms-activation-deploy) — Seed slugs for societyEvent documents that
 * currently lack one.
 *
 * Derivation is delegated entirely to the canonical algorithm in
 * contracts/checks/f5-event-slugs/_slugify.mjs (deriveSlugs()) — the same
 * module the contract's check scripts use to compute expected values. Do not
 * reimplement slugification here.
 *
 * Idempotent: only writes a slug to documents whose `slug` field is currently
 * empty. Never overwrites or re-derives an existing slug — slugs are
 * user-visible, effectively-permanent URLs. A second run against a
 * fully-seeded set is a no-op (nothing to write).
 *
 * hostSociety is explicitly OUT OF SCOPE for this script — not read, not
 * written.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package
 * — its startup banner writes to stdout and has corrupted an env value
 * before on this project):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-event-slugs.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

import { deriveSlugs } from '../contracts/checks/f5-event-slugs/_slugify.mjs';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
// ---------------------------------------------------------------------------

function readEnvLocal() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = readEnvLocal();
const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
const token = env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seeding event slugs in Sanity dataset "${dataset}" (project ${projectId})`);

  const events = await client.fetch(
    `*[_type == "societyEvent"]{_id, title, date, "slug": slug.current}`,
  );

  if (events.length === 0) {
    console.log('No societyEvent documents found. Nothing to do.');
    return;
  }

  const missing = events.filter((e) => typeof e.slug !== 'string' || e.slug.trim().length === 0);
  const existingSlugs = events
    .filter((e) => typeof e.slug === 'string' && e.slug.trim().length > 0)
    .map((e) => e.slug);

  console.log(
    `Found ${events.length} societyEvent document(s): ${missing.length} missing a slug, ` +
      `${existingSlugs.length} already seeded (untouched).`,
  );

  if (missing.length === 0) {
    console.log('All documents already have a slug. No-op.');
    return;
  }

  const toDerive = missing.map((e) => ({ id: e._id, title: e.title, date: e.date }));
  const derived = deriveSlugs(toDerive, existingSlugs);

  const tx = client.transaction();
  for (const doc of missing) {
    const slug = derived.get(doc._id);
    tx.patch(doc._id, (p) => p.set({ slug: { _type: 'slug', current: slug } }));
    console.log(`  ${doc._id} ("${doc.title}") -> "${slug}"`);
  }

  await tx.commit();
  console.log(`Seed complete. Assigned ${missing.length} slug(s).`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
