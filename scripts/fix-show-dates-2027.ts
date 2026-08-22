/**
 * One-off, idempotent patch that corrects the stale '18-21 September 2027' placeholder
 * dates still live in three production Sanity documents to the confirmed real dates,
 * Thursday 16 - Sunday 19 September 2027 (per project memory project_show_dates_placeholder).
 *
 * Documents patched, all with .set() (never .setIfMissing()):
 *   - nationalShow (_id: "nationalShow") — showDate, showEndDate, countdownDate
 *   - show-19-2027 (_id: "show-19-2027", _type: "show") — startDate, endDate
 *       This document's startDate/endDate were already SET to the stale values by
 *       scripts/migrate-show-sales-fields.ts's setIfMissing patch — a setIfMissing-based
 *       fix here would silently no-op, so .set() is required.
 *   - societyEvent-15-19th-south-african-national-orchid-show — date, endDate
 *
 * .set() is deliberately used instead of setIfMissing()/createOrReplace(): these fields
 * are already populated with the wrong value and must be overwritten, but every other
 * field on each document is left untouched.
 *
 * Idempotent: a second run against already-corrected documents patches the same values
 * again — harmless, no error, no drift.
 *
 * Required env (read directly from .env.local, matching scripts/migrate-show-sales-fields.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/fix-show-dates-2027.ts [--dry-run]
 * Verify with: node --import tsx/esm scripts/fix-show-dates-2027.ts --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local (see file header).
// ---------------------------------------------------------------------------

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

const NATIONAL_SHOW_ID = 'nationalShow';
const ACTIVE_SHOW_ID = 'show-19-2027';
const SOCIETY_EVENT_ID = 'societyEvent-15-19th-south-african-national-orchid-show';

const SHOW_START_ISO = '2027-09-16T09:00:00+02:00';
const SHOW_END_ISO = '2027-09-19T17:00:00+02:00';
const SOCIETY_EVENT_START_DATE = '2027-09-16';
const SOCIETY_EVENT_END_DATE = '2027-09-19';

interface PatchTarget {
  id: string;
  fields: Record<string, string>;
}

const PATCHES: PatchTarget[] = [
  {
    id: NATIONAL_SHOW_ID,
    fields: {
      showDate: SHOW_START_ISO,
      showEndDate: SHOW_END_ISO,
      countdownDate: SHOW_START_ISO,
    },
  },
  {
    id: ACTIVE_SHOW_ID,
    fields: {
      startDate: SHOW_START_ISO,
      endDate: SHOW_END_ISO,
    },
  },
  {
    id: SOCIETY_EVENT_ID,
    fields: {
      date: SOCIETY_EVENT_START_DATE,
      endDate: SOCIETY_EVENT_END_DATE,
    },
  },
];

async function patchDocument(target: PatchTarget): Promise<void> {
  console.log(`  ${target.id}:`);
  console.log(`    would set: ${JSON.stringify(target.fields, null, 2)}`);

  if (DRY_RUN) return;

  await client.patch(target.id).set(target.fields).commit({ autoGenerateArrayKeys: false });
  console.log('    patched (set)');
}

async function runPatch(): Promise<void> {
  console.log(
    `Patching stale show dates in Sanity dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );
  for (const target of PATCHES) {
    await patchDocument(target);
  }
  console.log(DRY_RUN ? 'Dry run complete — no documents were written.' : 'Patch complete.');
}

async function runVerify(): Promise<void> {
  console.log(`Verifying show dates in Sanity dataset "${dataset}" (project ${projectId})`);

  let allPassed = true;

  const nationalShow = await client.fetch<{
    showDate: string | null;
    showEndDate: string | null;
    countdownDate: string | null;
  } | null>(`*[_type == "nationalShow" && _id == $id][0]{showDate, showEndDate, countdownDate}`, {
    id: NATIONAL_SHOW_ID,
  });
  allPassed =
    checkField(NATIONAL_SHOW_ID, 'showDate', nationalShow?.showDate, SHOW_START_ISO) && allPassed;
  allPassed =
    checkField(NATIONAL_SHOW_ID, 'showEndDate', nationalShow?.showEndDate, SHOW_END_ISO) &&
    allPassed;
  allPassed =
    checkField(NATIONAL_SHOW_ID, 'countdownDate', nationalShow?.countdownDate, SHOW_START_ISO) &&
    allPassed;

  const activeShow = await client.fetch<{
    startDate: string | null;
    endDate: string | null;
  } | null>(`*[_type == "show" && _id == $id][0]{startDate, endDate}`, { id: ACTIVE_SHOW_ID });
  allPassed =
    checkField(ACTIVE_SHOW_ID, 'startDate', activeShow?.startDate, SHOW_START_ISO) && allPassed;
  allPassed = checkField(ACTIVE_SHOW_ID, 'endDate', activeShow?.endDate, SHOW_END_ISO) && allPassed;

  const societyEvent = await client.fetch<{ date: string | null; endDate: string | null } | null>(
    `*[_type == "societyEvent" && _id == $id][0]{date, endDate}`,
    { id: SOCIETY_EVENT_ID }
  );
  allPassed =
    checkField(SOCIETY_EVENT_ID, 'date', societyEvent?.date, SOCIETY_EVENT_START_DATE) && allPassed;
  allPassed =
    checkField(SOCIETY_EVENT_ID, 'endDate', societyEvent?.endDate, SOCIETY_EVENT_END_DATE) &&
    allPassed;

  if (allPassed) {
    console.log('VERIFY PASS — all fields hold the corrected dates.');
  } else {
    console.error('VERIFY FAIL — one or more fields do not hold the corrected dates.');
    process.exit(1);
  }
}

function checkField(
  docId: string,
  field: string,
  actual: string | null | undefined,
  expected: string
): boolean {
  const pass = actual === expected;
  console.log(
    `  [${pass ? 'PASS' : 'FAIL'}] ${docId}.${field}: expected "${expected}", got "${actual ?? 'null'}"`
  );
  return pass;
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
