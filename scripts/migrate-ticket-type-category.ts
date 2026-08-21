/**
 * F3 (ticketing-conferences-and-events, M2) — one-time, idempotent migration that backfills
 * the new required `ticketType.category` field onto whichever of the 15 canonical ticketType
 * documents (identified by `lib/provisional-figures.ts`'s ADMISSION_PRODUCTS/
 * CONFERENCE_PRODUCTS/WORKSHOP_FIELD_TRIP_PRODUCTS arrays) actually exist in the target
 * Sanity dataset today.
 *
 * DEFECT REPAIR (2026-08-21): the real live dataset has only 10 `ticketType` documents total,
 * and only 5 of those are covered by this feature's three product arrays (the 5 admission
 * products seeded by scripts/seed-ticketing.ts via `provisional-figures.ts`; the other 5 live
 * documents are legacy/inactive — `adult`/`child`/`exhibitor`/`pensioner`/`saoc-member` — not
 * tracked here at all, harmless since they're inactive and excluded by `active == true` in
 * every query). The 6 conference + 4 workshop-field-trip products have NOT been seeded into
 * the live dataset yet — that is scripts/seed-ticketing.ts's separate job, out of scope here.
 * Patching a document ID that doesn't exist yet would throw (Sanity's `.patch()` errors on a
 * nonexistent target), so this script first fetches which of the 15 canonical document IDs
 * actually exist (`existingIds`) and SKIPs (logs, never throws) any that don't. Those 10 will
 * already carry `category` at seed time via the `lib/provisional-figures.ts` spread once
 * scripts/seed-ticketing.ts eventually seeds them, making this script's work for those a safe
 * no-op by then.
 *
 * Keyed off lib/provisional-figures.ts's ADMISSION_PRODUCTS/CONFERENCE_PRODUCTS/
 * WORKSHOP_FIELD_TRIP_PRODUCTS arrays — the same single source of truth
 * contracts/checks/ticketing-purchase-pages-f3/check-category-assignment.mjs verifies — never
 * a second hand-typed slug-to-category table that could drift from the first. See
 * contracts/golden/ticketing-purchase-pages-f3/README.md.
 *
 * Follows scripts/migrate-show-sales-fields.ts's exact established pattern:
 *   - setIfMissing per document, never `.set()` — a second run, or an editor's own Studio
 *     edit between runs, is always a no-op / never reverted. This project's incident history
 *     (secret and content corruption from scripts that force-overwrite) is exactly why
 *     setIfMissing, not set(), is used throughout.
 *   - No delete(), no createOrReplace().
 *
 * Supports --dry-run: prints exactly which documents would be patched and with what
 * category, without writing anything.
 *
 * Required env (read directly from .env.local, matching scripts/seed-ticketing.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/migrate-ticket-type-category.ts [--dry-run]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

import {
  ADMISSION_PRODUCTS,
  CONFERENCE_PRODUCTS,
  WORKSHOP_FIELD_TRIP_PRODUCTS,
} from '../lib/provisional-figures';

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
      'NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
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

// Same `ticketType-${slug}` _id convention seed-ticketing.ts uses.
const ALL_PRODUCTS = [...ADMISSION_PRODUCTS, ...CONFERENCE_PRODUCTS, ...WORKSHOP_FIELD_TRIP_PRODUCTS];

async function fetchExistingIds(docIds: readonly string[]): Promise<Set<string>> {
  const found = await client.fetch<string[]>('*[_id in $ids]._id', { ids: docIds });
  return new Set(found);
}

async function backfillCategory(): Promise<void> {
  console.log('  ticketType.category backfill:');

  const allDocIds = ALL_PRODUCTS.map((product) => `ticketType-${product.slug}`);
  const existingIds = await fetchExistingIds(allDocIds);

  for (const product of ALL_PRODUCTS) {
    const docId = `ticketType-${product.slug}`;

    if (!existingIds.has(docId)) {
      console.log(`    ${docId}: SKIP — document does not exist yet in this dataset`);
      continue;
    }

    const fields = { category: product.category };
    console.log(`    ${docId}: would setIfMissing: ${JSON.stringify(fields)}`);

    if (DRY_RUN) continue;

    await client.patch(docId).setIfMissing(fields).commit({ autoGenerateArrayKeys: false });
    console.log(`    ${docId}: patched (setIfMissing — never overwrites an editor-set value)`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Migrating ticketType.category in Sanity dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );
  await backfillCategory();
  console.log(DRY_RUN ? 'Dry run complete — no documents were written.' : 'Migration complete.');
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
