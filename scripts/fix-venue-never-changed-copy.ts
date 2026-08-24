/**
 * One-off, idempotent patch that removes the "venue changed" narrative framing from
 * the live showVisitorInfo document's six visitor-facing prose fields. The venue
 * never changed — CTICC was an early incorrect placeholder never actually committed
 * to; the site must read as if it was simply always The Hangar, Stellenbosch Flying
 * Club, per Brad's 2026-08-24 instruction (project memory
 * venue-never-changed-copy-fix / contracts/golden/venue-never-changed-copy-fix-f1/).
 *
 * scripts/seed-show-visitor-info.ts uses createIfNotExists, so the source-code fix
 * to these six fields does not apply to the live document, which already exists —
 * same situation scripts/fix-visitor-info-dates-confirmed.ts already solved for the
 * "dates" confirmation field on this same document.
 *
 * Document patched, with .set() (never .setIfMissing()):
 *   - showVisitorInfo (_id: "showVisitorInfo") — researchLabel, planIntro,
 *     gettingThereIntro, parking, accommodationIntro, accessibility
 *
 * Idempotent: a second run against an already-corrected document patches the same
 * values again — harmless, no error, no drift.
 *
 * Required env (read directly from .env.local, matching
 * scripts/fix-visitor-info-dates-confirmed.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/fix-venue-never-changed-copy.ts [--dry-run]
 * Verify with: node --import tsx/esm scripts/fix-venue-never-changed-copy.ts --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
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
    'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, ' +
      'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN'
  );
}

const client: SanityClient = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

const VISITOR_INFO_ID = 'showVisitorInfo';

const CORRECTED_FIELDS: Record<string, string> = {
  researchLabel: 'Researched by the web team — not yet confirmed by the show committee',
  planIntro:
    'Everything you need to get to the National Orchid Show and make a day of it. Travel and ' +
    'accommodation guidance for the venue is still being put together; the show committee will ' +
    'confirm the final details.',
  gettingThereIntro:
    'Travel, parking and accommodation guidance for the Stellenbosch Flying Club has not been ' +
    'worked out yet. It will be published here once it is ready.',
  parking: 'Parking arrangements have not been confirmed.',
  accommodationIntro: 'Accommodation guidance for the Stellenbosch area is still being put together.',
  accessibility: 'Accessibility details have not been confirmed.',
};

async function runPatch(): Promise<void> {
  console.log(
    `Patching venue-never-changed copy in Sanity dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );

  for (const [field, value] of Object.entries(CORRECTED_FIELDS)) {
    console.log(`  ${VISITOR_INFO_ID}.${field}: would set to ${JSON.stringify(value)}`);
  }

  if (DRY_RUN) {
    console.log('Dry run complete — no documents were written.');
    return;
  }

  await client.patch(VISITOR_INFO_ID).set(CORRECTED_FIELDS).commit({ autoGenerateArrayKeys: false });
  console.log(`  ${VISITOR_INFO_ID}: patched`);

  console.log('Patch complete.');
}

async function runVerify(): Promise<void> {
  console.log(`Verifying venue-never-changed copy in dataset "${dataset}"`);

  let allPassed = true;

  const doc = await client.fetch<Record<string, string> | null>(
    `*[_id == $id][0]{${Object.keys(CORRECTED_FIELDS).join(', ')}}`,
    { id: VISITOR_INFO_ID }
  );

  for (const [field, expected] of Object.entries(CORRECTED_FIELDS)) {
    const actual = doc?.[field];
    const pass = actual === expected;
    console.log(
      `  [${pass ? 'PASS' : 'FAIL'}] ${VISITOR_INFO_ID}.${field}: expected ${JSON.stringify(expected)}, ` +
        `got ${JSON.stringify(actual ?? null)}`
    );
    allPassed = pass && allPassed;
  }

  if (allPassed) {
    console.log('VERIFY PASS — all six fields hold the corrected text.');
  } else {
    console.error('VERIFY FAIL — one or more fields do not hold the corrected text.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  if (VERIFY) {
    await runVerify();
    return;
  }
  await runPatch();
}

main().catch((err: unknown) => {
  console.error('Script failed:', err);
  process.exit(1);
});
