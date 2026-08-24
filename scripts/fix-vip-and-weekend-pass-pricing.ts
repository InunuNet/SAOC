/**
 * One-off, idempotent patch that migrates the live Sanity dataset's admission pricing to the
 * ticketing-flow-redesign F1 merged pricing model — see
 * contracts/golden/ticketing-flow-redesign-f1/README.md §4-6 for the full decision record.
 * lib/provisional-figures.ts (the source of truth for new seeds) already reflects the
 * go-forward shape; scripts/seed-ticketing.ts uses createIfNotExists, so that source-code fix
 * does not apply to documents that already exist in production — this separate patch script
 * is required, matching scripts/fix-visitor-info-dates-confirmed.ts's own precedent.
 *
 * Documents patched, all three in one release (never staged separately):
 *   - ticketType-vip: price 300 -> 480 (VIP must stay the top tier above Weekend Pass)
 *   - ticketType-weekend-pass: price 400 -> 380 (early-bird rate), regularPrice -> 400,
 *     earlyBirdCutoff -> EARLY_BIRD_CUTOFF, releasedQuantity unset (no staged-release
 *     restriction — see README §4 "Why capacity: 300, not 150 or 450")
 *   - ticketType-early-bird-weekend-pass: active -> false (retired, never deleted — a
 *     pre-production dataset with legacy demo/QA references by slug must not lose the
 *     document)
 *
 * Idempotent: a second run against already-corrected documents patches the same values again
 * — harmless, no error, no drift.
 *
 * Required env (read directly from .env.local, matching scripts/fix-show-dates-2027.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: npx tsx scripts/fix-vip-and-weekend-pass-pricing.ts --dry-run
 * Verify with: npx tsx scripts/fix-vip-and-weekend-pass-pricing.ts --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import { EARLY_BIRD_CUTOFF } from '@/lib/provisional-figures';

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

const VIP_ID = 'ticketType-vip';
const WEEKEND_PASS_ID = 'ticketType-weekend-pass';
const EARLY_BIRD_WEEKEND_PASS_ID = 'ticketType-early-bird-weekend-pass';

const VIP_PRICE = 480;
const WEEKEND_PASS_EARLY_BIRD_PRICE = 380;
const WEEKEND_PASS_REGULAR_PRICE = 400;

async function runPatch(): Promise<void> {
  console.log(
    `Patching VIP/Weekend Pass pricing in Sanity dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );

  console.log(`  ${VIP_ID}: would set price = ${VIP_PRICE}`);
  console.log(
    `  ${WEEKEND_PASS_ID}: would set price = ${WEEKEND_PASS_EARLY_BIRD_PRICE}, ` +
      `regularPrice = ${WEEKEND_PASS_REGULAR_PRICE}, earlyBirdCutoff = ${EARLY_BIRD_CUTOFF}; ` +
      `would unset releasedQuantity`
  );
  console.log(`  ${EARLY_BIRD_WEEKEND_PASS_ID}: would set active = false`);

  if (DRY_RUN) {
    console.log('Dry run complete — no documents were written.');
    return;
  }

  await client.patch(VIP_ID).set({ price: VIP_PRICE }).commit({ autoGenerateArrayKeys: false });
  console.log(`  ${VIP_ID}: patched`);

  await client
    .patch(WEEKEND_PASS_ID)
    .set({
      price: WEEKEND_PASS_EARLY_BIRD_PRICE,
      regularPrice: WEEKEND_PASS_REGULAR_PRICE,
      earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    })
    .unset(['releasedQuantity'])
    .commit({ autoGenerateArrayKeys: false });
  console.log(`  ${WEEKEND_PASS_ID}: patched`);

  await client
    .patch(EARLY_BIRD_WEEKEND_PASS_ID)
    .set({ active: false })
    .commit({ autoGenerateArrayKeys: false });
  console.log(`  ${EARLY_BIRD_WEEKEND_PASS_ID}: patched`);

  console.log('Patch complete.');
}

async function runVerify(): Promise<void> {
  console.log(`Verifying VIP/Weekend Pass pricing in dataset "${dataset}"`);

  let allPassed = true;

  const vip = await client.fetch<{ price?: number } | null>(`*[_id == $id][0]{price}`, {
    id: VIP_ID,
  });
  const pass1 = vip?.price === VIP_PRICE;
  console.log(
    `  [${pass1 ? 'PASS' : 'FAIL'}] ${VIP_ID}.price: expected ${VIP_PRICE}, got ${vip?.price ?? 'null'}`
  );
  allPassed = pass1 && allPassed;

  const weekendPass = await client.fetch<{
    price?: number;
    regularPrice?: number;
    earlyBirdCutoff?: string;
    releasedQuantity?: number;
  } | null>(`*[_id == $id][0]{price, regularPrice, earlyBirdCutoff, releasedQuantity}`, {
    id: WEEKEND_PASS_ID,
  });

  const pass2 = weekendPass?.price === WEEKEND_PASS_EARLY_BIRD_PRICE;
  console.log(
    `  [${pass2 ? 'PASS' : 'FAIL'}] ${WEEKEND_PASS_ID}.price: expected ` +
      `${WEEKEND_PASS_EARLY_BIRD_PRICE}, got ${weekendPass?.price ?? 'null'}`
  );
  allPassed = pass2 && allPassed;

  const pass3 = weekendPass?.regularPrice === WEEKEND_PASS_REGULAR_PRICE;
  console.log(
    `  [${pass3 ? 'PASS' : 'FAIL'}] ${WEEKEND_PASS_ID}.regularPrice: expected ` +
      `${WEEKEND_PASS_REGULAR_PRICE}, got ${weekendPass?.regularPrice ?? 'null'}`
  );
  allPassed = pass3 && allPassed;

  const cutoffMatches =
    weekendPass?.earlyBirdCutoff === EARLY_BIRD_CUTOFF ||
    (typeof weekendPass?.earlyBirdCutoff === 'string' &&
      new Date(weekendPass.earlyBirdCutoff).getTime() === new Date(EARLY_BIRD_CUTOFF).getTime());
  console.log(
    `  [${cutoffMatches ? 'PASS' : 'FAIL'}] ${WEEKEND_PASS_ID}.earlyBirdCutoff: expected ` +
      `${EARLY_BIRD_CUTOFF}, got ${weekendPass?.earlyBirdCutoff ?? 'null'}`
  );
  allPassed = cutoffMatches && allPassed;

  const pass5 = weekendPass?.releasedQuantity === undefined;
  console.log(
    `  [${pass5 ? 'PASS' : 'FAIL'}] ${WEEKEND_PASS_ID}.releasedQuantity: expected absent, ` +
      `got ${weekendPass?.releasedQuantity ?? 'null'}`
  );
  allPassed = pass5 && allPassed;

  const earlyBirdWeekendPass = await client.fetch<{ active?: boolean } | null>(
    `*[_id == $id][0]{active}`,
    { id: EARLY_BIRD_WEEKEND_PASS_ID }
  );
  const pass6 = earlyBirdWeekendPass?.active === false;
  console.log(
    `  [${pass6 ? 'PASS' : 'FAIL'}] ${EARLY_BIRD_WEEKEND_PASS_ID}.active: expected false, ` +
      `got ${earlyBirdWeekendPass?.active ?? 'null'}`
  );
  allPassed = pass6 && allPassed;

  if (allPassed) {
    console.log('VERIFY PASS — all fields hold the corrected values.');
  } else {
    console.error('VERIFY FAIL — one or more fields do not hold the corrected values.');
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
