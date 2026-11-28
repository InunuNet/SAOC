/**
 * One-off, idempotent patch: shorten four ticket-type `description` fields so they fit the
 * fixed NOS hero height (Brad approved, 27 Nov 2026). Copy is exactly as approved.
 *
 * For each ticket type, both the published document and its `drafts.` twin (if present) are
 * handled independently:
 *   - current value equals the expected old text  -> patch to the new text
 *   - current value already equals the new text   -> skip (already applied)
 *   - anything else                               -> skip and report; never overwritten
 * Every patched document is read back and the before/after strings are printed.
 *
 * Required env (read directly from .env.local, values are never printed):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/patch-ticket-description-trims-2026-11-27.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

interface Trim {
  id: string;
  current: string;
  next: string;
}

const TRIMS: readonly Trim[] = [
  {
    id: 'ticketType-early-bird',
    current: 'Single-day admission to the National Orchid Show during the early-bird window.',
    next: 'Single-day admission during the early-bird window.',
  },
  {
    id: 'ticketType-saoc-symposium',
    current: 'Full registration for the National Orchid Show Symposium track.',
    next: 'Full registration for the Symposium track.',
  },
  {
    id: 'ticketType-sunset-cocktails-single',
    current: 'Admission to the Sunset Cocktails evening reception. 18+ event.',
    next: 'Sunset Cocktails evening reception. 18+ event.',
  },
  {
    id: 'ticketType-speakers-partner',
    current:
      "One ticket for a speaker's partner, covering both the National Orchid Show Symposium " +
      'and the WOSA Conference.',
    next: "One ticket for a speaker's partner.",
  },
];

const DRAFT_PREFIX = 'drafts.';

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), '.env.local');
  const raw = readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

async function main() {
  const env = loadEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN');
  }

  const client = createClient({ projectId, dataset, token, apiVersion: '2024-01-01', useCdn: false });
  const skipped: string[] = [];

  for (const trim of TRIMS) {
    for (const docId of [trim.id, `${DRAFT_PREFIX}${trim.id}`]) {
      const exists = await client.fetch<boolean>(`count(*[_id == $id]) > 0`, { id: docId });
      if (!exists) {
        console.log(`[absent]  ${docId}`);
        continue;
      }
      const before = await client.fetch<string | null>(`*[_id == $id][0].description`, { id: docId });
      if (before === trim.next) {
        console.log(`[already] ${docId}: ${JSON.stringify(before)}`);
        continue;
      }
      if (before !== trim.current) {
        console.log(`[SKIPPED] ${docId}: unexpected current value ${JSON.stringify(before)}`);
        skipped.push(docId);
        continue;
      }
      await client.patch(docId).set({ description: trim.next }).commit();
      const after = await client.fetch<string | null>(`*[_id == $id][0].description`, { id: docId });
      console.log(`[patched] ${docId}`);
      console.log(`  before: ${JSON.stringify(before)}`);
      console.log(`  after:  ${JSON.stringify(after)}`);
      if (after !== trim.next) {
        throw new Error(`Read-back mismatch on ${docId}`);
      }
    }
  }

  if (skipped.length > 0) {
    console.log(`Skipped (unexpected text): ${skipped.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
