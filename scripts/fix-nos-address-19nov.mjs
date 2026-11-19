/**
 * One-off, idempotent Sanity patch from Brad's 19 Nov 2026 meeting with Lee-Ann: the venue is
 * "Stellenbosch Aerodrome" and "Stellenbosch Airfield" is dropped from the address.
 *   - nationalShow venue.addressLines ["Stellenbosch Airfield", "R44"] -> ["R44"];
 *   - venue.directionsNote and every other prose string (showPage, showFaq, showVisitorInfo ...):
 *     the "Airfield" phrase is removed (see PHRASE_RULES), drafts included.
 *
 * Env is read from .env.local (or the file named by ENV_FILE): NEXT_PUBLIC_SANITY_PROJECT_ID,
 * NEXT_PUBLIC_SANITY_DATASET, SANITY_API_TOKEN. Nothing secret is printed.
 *
 * Run:    node scripts/fix-nos-address-19nov.mjs [--dry-run]
 * Verify: node scripts/fix-nos-address-19nov.mjs --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const OLD_NAME = 'Stellenbosch Airfield';
const FALLBACK_NAME = 'Stellenbosch Aerodrome';
// Applied in order; the first four read naturally once the phrase is gone, the last is a safety net.
const PHRASE_RULES = [
  [/, Stellenbosch Airfield/g, ''],
  [/ at Stellenbosch Airfield/g, ''],
  [/ to Stellenbosch Airfield/g, ' to the venue'],
  [/Stellenbosch Airfield, /g, ''],
  [/Stellenbosch Airfield/g, FALLBACK_NAME],
];
const SKIPPED_FIELDS = new Set(['_id', '_rev', '_type', '_createdAt', '_updatedAt', '_key']);
const API_VERSION = '2024-01-01';

function readEnvFile() {
  const raw = readFileSync(path.resolve(process.cwd(), process.env.ENV_FILE ?? '.env.local'), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnvFile();
if (!env.NEXT_PUBLIC_SANITY_PROJECT_ID || !env.NEXT_PUBLIC_SANITY_DATASET || !env.SANITY_API_TOKEN) {
  throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET or SANITY_API_TOKEN');
}

const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: API_VERSION,
  token: env.SANITY_API_TOKEN,
  useCdn: false,
  perspective: 'raw',
});

const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

function rewritePhrase(value) {
  return PHRASE_RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function isStringArrayWithOldLine(node) {
  return Array.isArray(node) && node.length > 0 && node.every((item) => typeof item === 'string') &&
    node.includes(OLD_NAME);
}

/** Collects the edits: a string array drops its bare "Stellenbosch Airfield" line, a string is rewritten. */
function collectEdits(node, pathSoFar, id, out) {
  if (typeof node === 'string') {
    if (node.includes(OLD_NAME)) out.push({ id, path: pathSoFar, value: node, next: rewritePhrase(node) });
  } else if (isStringArrayWithOldLine(node)) {
    out.push({ id, path: pathSoFar, value: node, next: node.filter((line) => line !== OLD_NAME).map(rewritePhrase) });
  } else if (Array.isArray(node)) {
    node.forEach((item, index) => {
      const key = item && typeof item === 'object' && typeof item._key === 'string' ? item._key : null;
      collectEdits(item, `${pathSoFar}[${key ? `_key=="${key}"` : index}]`, id, out);
    });
  } else if (node && typeof node === 'object') {
    for (const [field, value] of Object.entries(node)) {
      if (SKIPPED_FIELDS.has(field)) continue;
      collectEdits(value, pathSoFar ? `${pathSoFar}.${field}` : field, id, out);
    }
  }
}

async function plan() {
  const docs = await client.fetch('*[!(_type match "system.*") && !(_type match "sanity.*")]');
  const edits = [];
  for (const doc of docs) collectEdits(doc, '', doc._id, edits);
  return edits;
}

const show = (value) => JSON.stringify(value).slice(0, 200);

async function main() {
  const edits = await plan();
  if (VERIFY) {
    if (edits.length > 0) {
      for (const e of edits) console.log(`STILL OLD  ${e.id} ${e.path}: ${show(e.value)}`);
      process.exit(1);
    }
    console.log('verify ok: no document mentions Stellenbosch Airfield');
    return;
  }
  for (const e of edits) console.log(`${e.id} ${e.path}\n  old: ${show(e.value)}\n  new: ${show(e.next)}`);
  console.log(`${edits.length} field(s) to patch${DRY_RUN ? ' (dry run, nothing written)' : ''}`);
  if (DRY_RUN) return;
  for (const e of edits) await client.patch(e.id).set({ [e.path]: e.next }).commit();
  const left = await plan();
  if (left.length > 0) throw new Error(`${left.length} field(s) still mention ${OLD_NAME} after patching`);
  console.log('patched and re-read: ok');
}

await main();
