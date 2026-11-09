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
const APPLY = process.argv.includes('--apply');

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

  const docs = await client.fetch('*[_id in $ids]{_id, _rev, venue}', { ids: DOC_IDS });
  const byId = new Map(docs.map((d) => [d._id, d]));
  const missing = DOC_IDS.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`Published doc(s) not found: ${missing.join(', ')}`);
  }

  let patched = 0;
  for (const id of DOC_IDS) {
    const doc = byId.get(id);
    const set = planPatch(doc);
    if (!set) {
      console.log(`\n${id}: already carries the new venue name, nothing to do.`);
      continue;
    }
    report(id, doc, set);
    if (APPLY) {
      await client.patch(id).ifRevisionId(doc._rev).set(set).commit();
      patched += 1;
    }
  }

  console.log(APPLY ? `\nApplied: ${patched} doc(s) patched.` : '\nDry run only. Re-run with --apply to write.');
}

main().catch((err) => {
  console.error('Venue name patch failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
