/**
 * One-off, idempotent Sanity patch for the 19 Nov 2026 ticket decisions (Brad and Lee-Ann):
 *   - early-bird: earlyBirdCutoff = EARLY_BIRD_CUTOFF (end of February 2027, SAST)
 *   - saoc-symposium, wosa-conference: price 1200 (early bird), regularPrice 1500, same cut-off,
 *     requiresRegistration unchanged
 *   - weekend-pass-early-bird: active = false (the Weekend Pass has no early bird)
 *   - speakers-partner: created if missing (hidden R950 ticket), never overwritten
 * Every value comes from lib/provisional-figures.ts, the single source of truth. Each patch
 * prints old -> new, then the document is read back and compared.
 *
 * Required env in .env.local (never printed): NEXT_PUBLIC_SANITY_PROJECT_ID,
 * NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN (write-enabled).
 *
 * Run: node --import tsx/esm scripts/fix-ticket-prices-19nov.ts [--dry-run] [--with-partner]
 * Verify only: node --import tsx/esm scripts/fix-ticket-prices-19nov.ts --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import {
  CONFERENCE_PRODUCTS,
  EARLY_BIRD_CUTOFF,
  RETIRED_ADMISSION_SLUGS,
  SPEAKERS_PARTNER_PRODUCT,
  ADMISSION_PRODUCTS,
} from '../lib/provisional-figures';

import { buildTicketTypeDoc, fetchActiveShowId } from './seed-ticketing';

type Fields = Record<string, unknown>;

interface Patch {
  slug: string;
  set: Fields;
}

function readEnvLocal(): Record<string, string> {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
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
// Create the hidden ticket only after the code that protects it is deployed: before that the
// generic /tickets/<slug> page of the live site would serve it with no password.
const WITH_PARTNER = process.argv.includes('--with-partner');

function planPatches(): Patch[] {
  const earlyBirdDay = ADMISSION_PRODUCTS.find((p) => p.slug === 'early-bird');
  if (!earlyBirdDay) throw new Error('early-bird product missing from lib/provisional-figures.ts');
  const patches: Patch[] = [
    { slug: earlyBirdDay.slug, set: { earlyBirdCutoff: EARLY_BIRD_CUTOFF } },
    ...CONFERENCE_PRODUCTS.map((p) => ({
      slug: p.slug,
      set: {
        price: p.price,
        regularPrice: p.regularPrice ?? null,
        earlyBirdCutoff: p.earlyBirdCutoff,
      },
    })),
    ...RETIRED_ADMISSION_SLUGS.filter((slug) => slug === 'weekend-pass-early-bird').map(
      (slug) => ({ slug, set: { active: false } })
    ),
  ];
  return patches;
}

async function readFields(slug: string, keys: string[]): Promise<Fields | null> {
  const projection = keys.join(', ');
  return client.fetch<Fields | null>(
    `*[_type == "ticketType" && slug.current == $slug][0]{ ${projection} }`,
    { slug }
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

async function applyPatch(patch: Patch): Promise<void> {
  const keys = Object.keys(patch.set);
  const before = await readFields(patch.slug, ['_id', ...keys]);
  if (!before) {
    console.log(`  ${patch.slug}: no document — skipped`);
    return;
  }
  for (const key of keys) {
    console.log(
      `  ${patch.slug}.${key}: ${JSON.stringify(before[key] ?? null)} -> ` +
        JSON.stringify(patch.set[key])
    );
  }
  if (DRY_RUN) return;
  await client.patch(String(before._id)).set(patch.set).commit({ autoGenerateArrayKeys: false });
}

async function ensureSpeakersPartner(): Promise<void> {
  const exists = await readFields(SPEAKERS_PARTNER_PRODUCT.slug, ['_id']);
  if (exists) {
    console.log(`  ${SPEAKERS_PARTNER_PRODUCT.slug}: already exists — left untouched`);
    return;
  }
  const showId = await fetchActiveShowId(client);
  const doc = buildTicketTypeDoc(SPEAKERS_PARTNER_PRODUCT, 100, showId);
  console.log(
    `  ${SPEAKERS_PARTNER_PRODUCT.slug}: (none) -> create price ${SPEAKERS_PARTNER_PRODUCT.price}, ` +
      `category ${SPEAKERS_PARTNER_PRODUCT.category}, capacity ${SPEAKERS_PARTNER_PRODUCT.capacity}`
  );
  if (!DRY_RUN) await client.createIfNotExists(doc);
}

async function verify(): Promise<void> {
  let allPassed = true;
  for (const patch of planPatches()) {
    const after = await readFields(patch.slug, Object.keys(patch.set));
    for (const [key, expected] of Object.entries(patch.set)) {
      const ok = after !== null && sameValue(after[key], expected);
      console.log(
        `  [${ok ? 'PASS' : 'FAIL'}] ${patch.slug}.${key}: expected ${JSON.stringify(expected)}, ` +
          `got ${JSON.stringify(after?.[key] ?? null)}`
      );
      allPassed = ok && allPassed;
    }
  }
  if (!WITH_PARTNER) {
    if (!allPassed) process.exit(1);
    console.log('VERIFY PASS (speakers-partner not checked)');
    return;
  }
  const partner = await readFields(SPEAKERS_PARTNER_PRODUCT.slug, [
    'price',
    'category',
    'active',
    'requiresRegistration',
  ]);
  const partnerOk =
    partner !== null &&
    partner.price === SPEAKERS_PARTNER_PRODUCT.price &&
    partner.category === SPEAKERS_PARTNER_PRODUCT.category &&
    partner.active === true &&
    partner.requiresRegistration === true;
  console.log(`  [${partnerOk ? 'PASS' : 'FAIL'}] ${SPEAKERS_PARTNER_PRODUCT.slug}: ${JSON.stringify(partner)}`);
  allPassed = partnerOk && allPassed;
  if (!allPassed) {
    console.error('VERIFY FAIL');
    process.exit(1);
  }
  console.log('VERIFY PASS');
}

async function main(): Promise<void> {
  console.log(
    `Ticket prices 19 Nov in dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN]' : '')
  );
  if (VERIFY) {
    await verify();
    return;
  }
  for (const patch of planPatches()) await applyPatch(patch);
  if (WITH_PARTNER) await ensureSpeakersPartner();
  else console.log('  speakers-partner: not created (pass --with-partner after deploy)');
  console.log(DRY_RUN ? 'Dry run complete.' : 'Patch complete. Run again with --verify.');
}

main().catch((err: unknown) => {
  console.error('Script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
