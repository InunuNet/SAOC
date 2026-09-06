/**
 * One-off, non-destructive patch: reword the live `ticketsPage.termsNote` field so it no
 * longer contradicts /refunds's real tiered cancellation schedule (audit-c-policy-pages,
 * 2026-09-06). Uses `.patch().set()` on a single field of the existing `ticketsPage`
 * singleton — every other field on the document is left untouched. Safe to re-run: it
 * always sets the same literal string, matching scripts/seed-ticketing.ts's updated
 * `termsNote` value (kept in sync by hand — this script exists only because
 * createIfNotExists in seed-ticketing.ts does not update an already-existing document).
 *
 * Required env (read directly from .env.local):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/patch-tickets-terms-note.ts
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const NEW_TERMS_NOTE =
  'Admission tickets may be transferred to another attendee by emailing info@saoc.co.za ' +
  'before the show. Please bring your booking reference to the door.';

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

  const before = await client.fetch<string | null>(`*[_id == "ticketsPage"][0].termsNote`);
  console.log('Before:', before);

  const exists = await client.fetch<boolean>(`defined(*[_id == "ticketsPage"][0]._id)`);
  if (!exists) {
    console.log('No ticketsPage document exists yet — nothing to patch (seed-ticketing.ts will create it with the corrected copy).');
    return;
  }

  await client.patch('ticketsPage').set({ termsNote: NEW_TERMS_NOTE }).commit();

  const after = await client.fetch<string | null>(`*[_id == "ticketsPage"][0].termsNote`);
  console.log('After:', after);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
