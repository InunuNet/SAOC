/**
 * One-off Sanity patch: the NOS venue name (nos-landing-leeann-1109, Lee-Ann's venue answer).
 *
 * Two published docs carry the old name, `nationalShow` and `show-19-2027`:
 *   venue.name           -> "Hangar 25, Orca Aero Solutions"
 *   venue.directionsNote -> the exact phrase "the hangar at Stellenbosch Flying Club" is replaced
 *                           with "Hangar 25, Orca Aero Solutions"
 *
 * Dry run by default: prints a before/after for each doc and exits 0, writing nothing.
 * `--apply` patches each doc with an ifRevisionID guard (a doc edited since it was read is refused,
 * not overwritten). Run --apply only after Brad approves the push. The token is never printed.
 *
 * Required env (.env.local, parsed directly, no dotenv):
 *   NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN
 *
 * Run with: node scripts/sanity-venue-name-1109.mjs [--apply]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const DOC_IDS = ['nationalShow', 'show-19-2027'];
const NEW_VENUE_NAME = 'Hangar 25, Orca Aero Solutions';
const OLD_NOTE_PHRASE = 'the hangar at Stellenbosch Flying Club';
const API_VERSION = '2024-01-01';
const REVISION_CONFLICT_STATUS = 409;
const APPLY = process.argv.includes('--apply');

/** A fixed description for a client error; server-supplied text, headers and the token are never echoed. */
function describeFailure(err) {
  return err?.statusCode === REVISION_CONFLICT_STATUS
    ? 'patch rejected (revision changed)'
    : 'request failed';
}

function readEnvLocal() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out = {};
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

/** The fields to set on a doc, or null when it already carries the new name. */
function planPatch(doc) {
  const venue = doc.venue ?? {};
  const set = {};
  if (venue.name !== NEW_VENUE_NAME) set['venue.name'] = NEW_VENUE_NAME;
  if (typeof venue.directionsNote === 'string' && venue.directionsNote.includes(OLD_NOTE_PHRASE)) {
    set['venue.directionsNote'] = venue.directionsNote.split(OLD_NOTE_PHRASE).join(NEW_VENUE_NAME);
  }
  return Object.keys(set).length > 0 ? set : null;
}

function report(id, doc, set) {
  const venue = doc.venue ?? {};
  console.log(`\n${id} (rev ${doc._rev})`);
  for (const field of ['name', 'directionsNote']) {
    const key = `venue.${field}`;
    console.log(`  ${key}`);
    console.log(`    before: ${JSON.stringify(venue[field] ?? null)}`);
    console.log(`    after:  ${JSON.stringify(set[key] ?? venue[field] ?? null)}`);
  }
}

async function main() {
  const env = readEnvLocal();
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID;
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET;
  const token = env.SANITY_API_TOKEN;
  if (!projectId || !dataset || !token) {
    throw new Error(
      'Missing required env vars in .env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN',
    );
  }
  const client = createClient({ projectId, dataset, apiVersion: API_VERSION, token, useCdn: false });

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} against dataset "${dataset}" (project ${projectId})`);

  let docs;
  try {
    docs = await client.fetch('*[_id in $ids]{_id, _rev, venue}', { ids: DOC_IDS });
  } catch (err) {
    throw new Error(`read failed (${describeFailure(err)})`);
  }
  const byId = new Map(docs.map((d) => [d._id, d]));
  const missing = DOC_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`Published doc(s) not found: ${missing.join(', ')}`);
  }

  const written = [];
  const failed = [];
  for (const id of DOC_IDS) {
    const doc = byId.get(id);
    const set = planPatch(doc);
    report(id, doc, set ?? {});
    if (!set) {
      console.log('  no change needed');
      continue;
    }
    if (!APPLY) continue;
    try {
      const updated = await client.patch(id).ifRevisionId(doc._rev).set(set).commit();
      written.push({ id, rev: updated._rev });
    } catch (err) {
      failed.push({ id, status: err?.statusCode, description: describeFailure(err) });
    }
  }

  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.');
    return;
  }
  console.log(`\nWritten: ${written.length} doc(s).`);
  for (const { id, rev } of written) console.log(`  ${id} -> rev ${rev}`);
  if (failed.length > 0) {
    console.error(`Failed: ${failed.length} doc(s).`);
    for (const { id, status, description } of failed) {
      console.error(`  ${id}: HTTP ${status ?? 'n/a'}, ${description}`);
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // Only messages this script wrote reach here; client errors are reduced by describeFailure first.
  console.error('Venue name patch failed:', err instanceof Error ? err.message : 'request failed');
  process.exit(1);
});
