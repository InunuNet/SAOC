/**
 * F4 one-off backfill: adds `threshold` and `order` to the 6 existing `award`
 * documents in Sanity. Mechanical migration — values taken verbatim from
 * lib/data/awards.ts, matching the curated display sequence (AM, FCC, HCC, CCM,
 * CBR, JC) already live via the static import. Uses patch() (field-level update),
 * not createOrReplace, so no other field on these documents is touched.
 *
 * Run with: pnpm exec tsx scripts/backfill-award-fields.ts
 *
 * Required env (from .env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN
 */

import { config } from 'dotenv';
import { createClient } from '@sanity/client';

config({ path: '.env.local', quiet: true });

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  throw new Error(
    'Missing required env vars: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
  );
}

const client = createClient({
  projectId,
  dataset,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
});

// Verbatim from lib/data/awards.ts. `order` preserves the curated, non-alphabetical
// display sequence (AM, FCC, HCC, CCM, CBR, JC) already live via the static import.
const BACKFILL: Record<string, { threshold: string; order: number }> = {
  'award-am-saoc': { threshold: '80–89 pts', order: 1 },
  'award-fcc-saoc': { threshold: '90+ pts', order: 2 },
  'award-hcc-saoc': { threshold: '75–79 pts', order: 3 },
  'award-ccm-saoc': { threshold: '80+ pts', order: 4 },
  'award-cbr-saoc': { threshold: '—', order: 5 },
  'award-jc-saoc': { threshold: '—', order: 6 },
};

async function main(): Promise<void> {
  console.log(`Backfilling award threshold/order in dataset "${dataset}" (project ${projectId})`);

  const tx = client.transaction();
  for (const [id, fields] of Object.entries(BACKFILL)) {
    tx.patch(id, (p) => p.set(fields));
  }
  await tx.commit();

  console.log(`Backfilled ${Object.keys(BACKFILL).length} award documents.`);
}

main().catch((err: unknown) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
