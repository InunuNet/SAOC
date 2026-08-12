/**
 * F3 (cms-wiring-cleanup) — Seed the `order` field on the nine province documents.
 *
 * The /societies filter chips are sourced from the `province` documents rather than
 * from the hardcoded lib/data/provinces array. That array's sequence is curated, not
 * alphabetical, so without an explicit ordering field the chips would silently
 * reshuffle into alphabetical order — a visitor-facing regression.
 *
 * Values come from the golden, not from a literal retyped here:
 *   .agent/memory/project/specs/cms-wiring-cleanup/goldens/province-chip-order.golden.json
 *
 * Uses `setIfMissing` inside a patch, NEVER createOrReplace: these are nine real
 * documents holding real content, and this script must only fill a gap. Re-running it
 * is a no-op once every province has an order. Pass --force to overwrite existing
 * order values back to the golden sequence.
 *
 * Required env (read directly from .env.local, NOT via the `dotenv` package — its
 * startup banner writes to stdout and has corrupted an env value before on this
 * project):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/seed-province-order.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient, type SanityClient } from '@sanity/client';

const GOLDEN_PATH =
  '.agent/memory/project/specs/cms-wiring-cleanup/goldens/province-chip-order.golden.json';

// ---------------------------------------------------------------------------
// Env — parsed directly from .env.local, no dotenv (see file header).
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

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

interface ProvinceDoc {
  _id: string;
  code: string | null;
  name: string | null;
  order: number | null;
}

function readGoldenOrder(): Record<string, number> {
  const raw = JSON.parse(readFileSync(path.resolve(process.cwd(), GOLDEN_PATH), 'utf8'));
  const values: Record<string, number> = {};
  for (const [code, order] of Object.entries(raw.orderValues)) {
    // The golden carries a `_comment` key alongside the real codes.
    if (typeof order === 'number') values[code] = order;
  }
  if (Object.keys(values).length === 0) {
    throw new Error(`${GOLDEN_PATH} declared no numeric orderValues — refusing to seed.`);
  }
  return values;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const goldenOrder = readGoldenOrder();

  const docs = await client.fetch<ProvinceDoc[]>(
    '*[_type == "province"]{ _id, code, name, order }',
  );
  if (docs.length === 0) {
    throw new Error('No `province` documents found — run `pnpm seed` first.');
  }

  console.log(`Seeding chip order onto ${docs.length} province document(s):`);

  let written = 0;
  let skipped = 0;
  const unknown: string[] = [];

  for (const doc of docs) {
    const code = doc.code ?? '';
    const order = goldenOrder[code];
    if (order === undefined) {
      unknown.push(`${doc._id} (code "${code}")`);
      continue;
    }
    if (doc.order !== null && doc.order !== undefined && !force) {
      console.log(`  ${code}: already order ${doc.order} — left alone`);
      skipped += 1;
      continue;
    }
    const patch = client.patch(doc._id);
    await (force ? patch.set({ order }) : patch.setIfMissing({ order })).commit();
    console.log(`  ${code}: order ${order}`);
    written += 1;
  }

  if (unknown.length > 0) {
    console.warn(
      `WARNING: ${unknown.length} province document(s) have no entry in the golden and were ` +
        `left untouched: ${unknown.join(', ')}`,
    );
  }
  console.log(`Done — ${written} patched, ${skipped} already ordered.`);
}

main().catch((error: unknown) => {
  console.error('seed-province-order failed:', error);
  process.exitCode = 1;
});
