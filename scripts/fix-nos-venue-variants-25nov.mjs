/**
 * One-off, idempotent Sanity patch (25 Nov 2026): the 19 Nov venue rename to "Stellenbosch
 * Aerodrome" still left stale variants in the CMS (FAQ answers, the /faq hero venue label, visitor
 * info). The physical address is unchanged. Every string field of every document, drafts included,
 * is rewritten by the ordered rules below; a field that does not match is never touched.
 *
 * Env is read from .env.local (NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
 * SANITY_API_TOKEN); nothing secret is printed.
 *
 * Run:    node scripts/fix-nos-venue-variants-25nov.mjs [--apply]  (bare run = dry run)
 * Verify: node scripts/fix-nos-venue-variants-25nov.mjs --verify
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const NEW_VENUE = 'Stellenbosch Aerodrome';
const SKIPPED_FIELDS = new Set(['_id', '_rev', '_type', '_createdAt', '_updatedAt', '_key']);

// Ordered: the longest phrasings first, so the bare-name rules only see what is left.
const RULES = [
  [/Hangar 25, Orca Aero Solutions, Stellenbosch Airfield/gi, NEW_VENUE],
  [/Hangar 25, Orca Aero Solutions/gi, NEW_VENUE],
  [/The Hangar, Stellenbosch Flying Club, Stellenbosch Airfield/gi, NEW_VENUE],
  [/The Hangar, Stellenbosch Flying Club/gi, NEW_VENUE],
  [/the hangar at Stellenbosch Flying Club, Stellenbosch Airfield/gi, NEW_VENUE],
  [/the hangar at Stellenbosch Flying Club/gi, NEW_VENUE],
  [/(Stellenbosch Aerodrome|Flying Club),? on the R44 at Stellenbosch Airfield/gi, '$1, on the R44'],
  [/Stellenbosch Flying Club, Stellenbosch Airfield/gi, NEW_VENUE],
  [/Stellenbosch Flying Club/gi, NEW_VENUE],
  [/, Stellenbosch Airfield/gi, ''],
  [/ at Stellenbosch Airfield/gi, ''],
  [/ to Stellenbosch Airfield/gi, ' to the venue'],
  [/Stellenbosch Airfield, /gi, ''],
  [/Stellenbosch Airfield/gi, NEW_VENUE],
  [/Orca Aero( Solutions)?/gi, NEW_VENUE],
  [/Hangar 25/gi, NEW_VENUE],
];
const STALE = /Hangar 25|Orca Aero|Stellenbosch Airfield|Stellenbosch Flying Club/i;

function readEnvLocal() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
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

const env = readEnvLocal();
if (!env.NEXT_PUBLIC_SANITY_PROJECT_ID || !env.NEXT_PUBLIC_SANITY_DATASET || !env.SANITY_API_TOKEN) {
  throw new Error('Missing NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET or SANITY_API_TOKEN in .env.local');
}

const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token: env.SANITY_API_TOKEN,
  useCdn: false,
  perspective: 'raw',
});

// Safe by default: writes need an explicit --apply; --dry-run is accepted and always wins.
const DRY_RUN = !process.argv.includes('--apply') || process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

/** Collects every { id, path, value } string leaf, with Sanity-style paths (keyed array items). */
function collectStrings(node, pathSoFar, id, out) {
  if (typeof node === 'string') {
    out.push({ id, path: pathSoFar, value: node });
  } else if (Array.isArray(node)) {
    node.forEach((item, index) => {
      const key = item && typeof item === 'object' && typeof item._key === 'string' ? item._key : null;
      collectStrings(item, `${pathSoFar}[${key ? `_key=="${key}"` : index}]`, id, out);
    });
  } else if (node && typeof node === 'object') {
    for (const [field, value] of Object.entries(node)) {
      if (SKIPPED_FIELDS.has(field)) continue;
      collectStrings(value, pathSoFar ? `${pathSoFar}.${field}` : field, id, out);
    }
  }
}

function rewrite(value) {
  return RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

async function plan() {
  const docs = await client.fetch('*[!(_type match "system.*") && !(_type match "sanity.*")]');
  const leaves = [];
  for (const doc of docs) collectStrings(doc, '', doc._id, leaves);
  const edits = [];
  for (const leaf of leaves) {
    if (STALE.test(leaf.value)) edits.push({ ...leaf, next: rewrite(leaf.value) });
  }
  return edits;
}

async function main() {
  const edits = await plan();
  if (VERIFY) {
    if (edits.length > 0) {
      for (const e of edits) console.log(`STILL OLD  ${e.id} ${e.path}: ${e.value.slice(0, 120)}`);
      process.exit(1);
    }
    console.log('verify ok: no document carries a stale venue variant');
    return;
  }
  for (const e of edits) {
    console.log(`${e.id} ${e.path}\n  old: ${e.value}\n  new: ${e.next}`);
  }
  console.log(`${edits.length} field(s) to patch${DRY_RUN ? ' (dry run, nothing written)' : ''}`);
  if (DRY_RUN) return;
  for (const e of edits) await client.patch(e.id).set({ [e.path]: e.next }).commit();
  const left = await plan();
  if (left.length > 0) throw new Error(`${left.length} field(s) still carry a stale variant after patching`);
  console.log('patched and re-read: ok');
}

await main();
