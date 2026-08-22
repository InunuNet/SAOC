/**
 * One-off, idempotent patch that corrects the "dates" confirmation status left over
 * from before Lee-Ann confirmed the show dates (Thursday 16 - Sunday 19 September 2027,
 * per project memory project_show_dates_placeholder). scripts/fix-show-dates-2027.ts
 * already corrected the date VALUES in production Sanity; this patches the STATUS
 * metadata next to those dates, which fix-show-dates-2027.ts did not touch.
 *
 * scripts/seed-show-visitor-info.ts uses createIfNotExists, so the source-code fix to
 * CONFIRMATIONS.dates and showFaq-general-3 there does not apply to documents that
 * already exist in production — both do, so this separate .patch().set() is required.
 *
 * Documents patched, both with .set() (never .setIfMissing()):
 *   - showVisitorInfo (_id: "showVisitorInfo") — confirmations.dates: 'pending' -> 'confirmed'
 *   - showFaq-general-3 (_id: "showFaq-general-3", _type: "showFaq") — status: 'pending' ->
 *     'confirmed', and the portable-text answer body rewritten to state the confirmed dates
 *     as fact instead of hedging
 *
 * Idempotent: a second run against already-corrected documents patches the same values
 * again — harmless, no error, no drift.
 *
 * Required env (read directly from .env.local, matching scripts/fix-show-dates-2027.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/fix-visitor-info-dates-confirmed.ts [--dry-run]
 * Verify with: node --import tsx/esm scripts/fix-visitor-info-dates-confirmed.ts --verify
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
const FAQ_ID = 'showFaq-general-3';

const FAQ_ANSWER_TEXT = 'Thursday 16 to Sunday 19 September 2027, confirmed by the show committee.';

function faqAnswerBlocks() {
  return [
    {
      _type: 'block',
      _key: 'a1b2c3d4e5f6',
      style: 'normal',
      markDefs: [],
      children: [
        { _type: 'span', _key: 'a1b2c3d4e5f7', text: FAQ_ANSWER_TEXT, marks: [] },
      ],
    },
  ];
}

async function runPatch(): Promise<void> {
  console.log(
    `Patching visitor-info dates confirmation status in Sanity dataset "${dataset}" ` +
      `(project ${projectId})` + (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );

  console.log(`  ${VISITOR_INFO_ID}: would set confirmations.dates = 'confirmed'`);
  console.log(
    `  ${FAQ_ID}: would set status = 'confirmed', answer = ${JSON.stringify(FAQ_ANSWER_TEXT)}`
  );

  if (DRY_RUN) {
    console.log('Dry run complete — no documents were written.');
    return;
  }

  await client
    .patch(VISITOR_INFO_ID)
    .set({ 'confirmations.dates': 'confirmed' })
    .commit({ autoGenerateArrayKeys: false });
  console.log(`  ${VISITOR_INFO_ID}: patched`);

  await client
    .patch(FAQ_ID)
    .set({ status: 'confirmed', answer: faqAnswerBlocks() })
    .commit({ autoGenerateArrayKeys: false });
  console.log(`  ${FAQ_ID}: patched`);

  console.log('Patch complete.');
}

async function runVerify(): Promise<void> {
  console.log(`Verifying visitor-info dates confirmation status in dataset "${dataset}"`);

  let allPassed = true;

  const visitorInfo = await client.fetch<{ confirmations?: { dates?: string } } | null>(
    `*[_id == $id][0]{confirmations}`,
    { id: VISITOR_INFO_ID }
  );
  const datesStatus = visitorInfo?.confirmations?.dates;
  const pass1 = datesStatus === 'confirmed';
  console.log(
    `  [${pass1 ? 'PASS' : 'FAIL'}] ${VISITOR_INFO_ID}.confirmations.dates: expected "confirmed", ` +
      `got "${datesStatus ?? 'null'}"`
  );
  allPassed = pass1 && allPassed;

  const faq = await client.fetch<{ status?: string } | null>(`*[_id == $id][0]{status}`, {
    id: FAQ_ID,
  });
  const pass2 = faq?.status === 'confirmed';
  console.log(
    `  [${pass2 ? 'PASS' : 'FAIL'}] ${FAQ_ID}.status: expected "confirmed", got "${faq?.status ?? 'null'}"`
  );
  allPassed = pass2 && allPassed;

  if (allPassed) {
    console.log('VERIFY PASS — both fields hold the corrected status.');
  } else {
    console.error('VERIFY FAIL — one or more fields do not hold the corrected status.');
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
