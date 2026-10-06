/**
 * One-off, idempotent patch that corrects the stale '16-19 September 2027' dates still
 * live in four production Sanity documents to the confirmed real dates, Thursday 23 -
 * Sunday 26 September 2027 (Brad's direct instruction, 2026-10-06 — a uniform +7-day
 * shift of the previous 16-19 correction, per
 * .agent/memory/project/specs/show-dates-23-26-sept-2027/goldens/m1-golden.md).
 *
 * Follows the convention of scripts/fix-show-dates-2027.ts, the precedent for this exact
 * kind of patch (same three documents plus one new one here: the show FAQ answer).
 *
 * Documents patched, all with .set() (never .setIfMissing()) — these fields are already
 * populated with the stale (now even-staler) 16-19 values and must be overwritten, every
 * other field on each document is left untouched:
 *   - nationalShow (_id: "nationalShow") — showDate, showEndDate, countdownDate
 *   - show-19-2027 (_id: "show-19-2027", _type: "show") — startDate, endDate
 *   - societyEvent-15-19th-south-african-national-orchid-show — date, endDate
 *   - showFaq "When is the show?" — answer. Its real _id is ambiguous in this repo's own
 *     records (dashes vs. dots disagree between the TS seed source and a historical
 *     golden file), so it is NOT guessed — it is resolved live by querying
 *     `*[_type == "showFaq" && question == "When is the show?"][0]._id` and patching
 *     whatever _id that query actually returns.
 *
 * Idempotent: a second run against already-corrected documents patches the same values
 * again — harmless, no error, no drift.
 *
 * Required env (read directly from .env.local, matching scripts/fix-show-dates-2027.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/fix-show-dates-23-26-sept-2027.ts [--dry-run]
 * Verify with: node --import tsx/esm scripts/fix-show-dates-23-26-sept-2027.ts --verify
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
const FAQ_QUESTION = 'When is the show?';

const SHOW_START_ISO = '2027-09-23T09:00:00+02:00';
const SHOW_END_ISO = '2027-09-26T17:00:00+02:00';
const SOCIETY_EVENT_START_DATE = '2027-09-23';
const SOCIETY_EVENT_END_DATE = '2027-09-26';
const FAQ_ANSWER_TEXT = 'Thursday 23 to Sunday 26 September 2027, confirmed by the show committee.';

interface PatchTarget {
  id: string;
  fields: Record<string, string>;
}

const FIXED_ID_PATCHES: PatchTarget[] = [
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

function faqAnswerBlocks() {
  return [
    {
      _type: 'block',
      _key: 'f23a26b09c7d',
      style: 'normal',
      markDefs: [],
      children: [
        { _type: 'span', _key: 'f23a26b09c7e', text: FAQ_ANSWER_TEXT, marks: [] },
      ],
    },
  ];
}

/** Resolve the "When is the show?" FAQ document's real _id by query — never guessed. */
async function resolveFaqId(): Promise<string | null> {
  return client.fetch<string | null>(
    `*[_type == "showFaq" && question == $question][0]._id`,
    { question: FAQ_QUESTION }
  );
}

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
  for (const target of FIXED_ID_PATCHES) {
    await patchDocument(target);
  }

  const faqId = await resolveFaqId();
  if (!faqId) {
    throw new Error(
      `Could not resolve showFaq document with question "${FAQ_QUESTION}" — aborting, ` +
        'not guessing an _id.'
    );
  }
  console.log(`  ${faqId} (resolved from question "${FAQ_QUESTION}"):`);
  console.log(`    would set: answer = ${JSON.stringify(FAQ_ANSWER_TEXT)}`);
  if (!DRY_RUN) {
    await client
      .patch(faqId)
      .set({ answer: faqAnswerBlocks() })
      .commit({ autoGenerateArrayKeys: false });
    console.log('    patched (set)');
  }

  console.log(DRY_RUN ? 'Dry run complete — no documents were written.' : 'Patch complete.');
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

function faqAnswerText(
  answer: Array<{ children?: Array<{ text?: string }> }> | null | undefined
): string | null {
  if (!answer || answer.length === 0) return null;
  const spans = answer[0]?.children ?? [];
  return spans.map((span) => span.text ?? '').join('') || null;
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

  const faqId = await resolveFaqId();
  if (!faqId) {
    console.log(`  [FAIL] showFaq "${FAQ_QUESTION}": no matching document found`);
    allPassed = false;
  } else {
    const faq = await client.fetch<{
      answer: Array<{ children?: Array<{ text?: string }> }> | null;
    } | null>(`*[_type == "showFaq" && _id == $id][0]{answer}`, { id: faqId });
    const actualText = faqAnswerText(faq?.answer);
    allPassed = checkField(faqId, 'answer', actualText, FAQ_ANSWER_TEXT) && allPassed;
  }

  if (allPassed) {
    console.log('VERIFY PASS — all fields hold the corrected dates.');
  } else {
    console.error('VERIFY FAIL — one or more fields do not hold the corrected dates.');
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
