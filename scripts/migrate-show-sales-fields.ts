/**
 * F1 (ticketing-foundation) — one-time, idempotent migration that makes show-19-2027
 * the first sales-capable `show` document and backfills the new required `ticketType.show`
 * reference onto the 5 pre-existing ticketType documents.
 *
 * See contracts/golden/ticketing-f1-show-collision/README.md, "Corrected design", for
 * why this patches the already-existing show-19-2027 document rather than creating a
 * new one, and why NATIONAL_SHOW_ID (Firestore showId scoping) is never touched here.
 *
 * Deliberately additive and non-destructive, matching scripts/seed-ticketing.ts's
 * pattern:
 *   - show-19-2027 is patched (never created/replaced) using setIfMissing for every
 *     new field, so a second run — or an editor's own edits in Studio between runs —
 *     is always a no-op / never reverted. This project's incident history (secret and
 *     content corruption from scripts that force-overwrite) is exactly why
 *     setIfMissing, not set(), is used throughout.
 *   - ticketType.show is backfilled with setIfMissing per document, for the same reason.
 *   - No delete(), no createOrReplace() — deletion is never this script's call to make.
 *
 * The sales-field VALUES below are not invented placeholders: they are read live from
 * the existing nationalShow singleton (edition, showDate/showEndDate, venue), which
 * already describes this same 2027 show. This keeps show-19-2027 consistent with the
 * data editors already see in Studio instead of introducing a second, drifting copy.
 *
 * Supports --dry-run: prints exactly which documents would be patched and with what
 * values, without writing anything.
 *
 * Required env (read directly from .env.local, matching scripts/seed-ticketing.ts):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET
 *   SANITY_API_TOKEN — write-enabled Editor token
 *
 * Run with: node --import tsx/esm scripts/migrate-show-sales-fields.ts [--dry-run]
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

const ACTIVE_SHOW_ID = 'show-19-2027';
const NATIONAL_SHOW_SINGLETON_ID = 'nationalShow';
const TICKET_TYPE_IDS = [
  'ticketType-adult',
  'ticketType-child',
  'ticketType-exhibitor',
  'ticketType-pensioner',
  'ticketType-saoc-member',
];

interface ShowVenue {
  name: string;
  addressLines?: string[];
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
  directionsNote?: string;
  phone?: string;
}

interface NationalShowSource {
  edition: number | null;
  showDate: string | null;
  showEndDate: string | null;
  venue: ShowVenue | null;
  salesOpen: boolean | null;
}

async function fetchNationalShowSource(): Promise<NationalShowSource> {
  const doc = await client.fetch<NationalShowSource | null>(
    `*[_type == "nationalShow"][0]{edition, showDate, showEndDate, venue, salesOpen}`
  );
  if (!doc) {
    throw new Error(
      `The nationalShow singleton (_id: '${NATIONAL_SHOW_SINGLETON_ID}') was not found — ` +
        'cannot derive show-19-2027 sales field values from it.'
    );
  }
  return doc;
}

async function migrateActiveShow(source: NationalShowSource): Promise<void> {
  const showFields = {
    edition: source.edition,
    startDate: source.showDate,
    endDate: source.showEndDate,
    venue: source.venue,
    salesOpen: false, // F1: deliberately not wired into checkout — see README.
    active: true,
  };

  console.log(`  ${ACTIVE_SHOW_ID}:`);
  console.log(`    would setIfMissing: ${JSON.stringify(showFields, null, 2)}`);

  if (DRY_RUN) return;

  await client
    .patch(ACTIVE_SHOW_ID)
    .setIfMissing(showFields)
    .commit({ autoGenerateArrayKeys: false });
  console.log('    patched (setIfMissing — never overwrites an editor-set value)');
}

async function backfillTicketTypeShowRefs(): Promise<void> {
  console.log('  ticketType.show backfill:');
  for (const id of TICKET_TYPE_IDS) {
    const showRef = { show: { _type: 'reference', _ref: ACTIVE_SHOW_ID } };
    console.log(`    ${id}: would setIfMissing: ${JSON.stringify(showRef)}`);

    if (DRY_RUN) continue;

    await client.patch(id).setIfMissing(showRef).commit({ autoGenerateArrayKeys: false });
    console.log(`    ${id}: patched (setIfMissing)`);
  }
}

async function main(): Promise<void> {
  console.log(
    `Migrating show sales fields in Sanity dataset "${dataset}" (project ${projectId})` +
      (DRY_RUN ? ' [DRY RUN — no writes]' : '')
  );
  const source = await fetchNationalShowSource();
  await migrateActiveShow(source);
  await backfillTicketTypeShowRefs();
  console.log(DRY_RUN ? 'Dry run complete — no documents were written.' : 'Migration complete.');
}

main().catch((err: unknown) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
