#!/usr/bin/env node
/**
 * leeann-quick-fixes (2026-11-11): patch production Sanity so the venue, show name and the
 * "Award Entries" wording match the code changes (Lee-Ann's Questions doc, B10 / B18 / B6).
 *
 * Dry run by default (also spelled --dry-run): prints doc, path, before, after, verdict.
 * --apply writes. Idempotent: a path already holding the NEW text and not the OLD is skipped;
 * a path holding neither is reported as drift, left untouched, and makes the run exit non-zero.
 * Both the published _id and `drafts.<_id>` (when the draft exists) are patched independently.
 *
 * Credentials come from .env.local in the working directory (no dotenv). Refuses any project
 * other than 26yfbug4.
 *
 * Run: node scripts/sanity-leeann-quick-fixes-1111.mjs [--apply]
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createClient } from '@sanity/client';

const EXPECTED_PROJECT_ID = '26yfbug4';
const API_VERSION = '2025-01-01';
const SNIPPET_LENGTH = 90;

const VENUE = 'Hangar 25, Orca Aero Solutions, Stellenbosch Airfield';
const NAME = 'National Orchid Show - Western Cape 2027';
const OLD_VENUE = 'The Hangar, Stellenbosch Flying Club';
const OLD_ENTRY_PHRASE = 'the 19th National Show';

/** @type {Array<{ id: string, path: string, from: string, to: string }>} */
const PATCHES = [
  { id: 'nationalShow', path: 'location', from: OLD_VENUE, to: VENUE },
  { id: 'show-19-2027', path: 'location', from: OLD_VENUE, to: VENUE },
  {
    id: 'societyEvent-15-19th-south-african-national-orchid-show',
    path: 'venue',
    from: OLD_VENUE,
    to: VENUE,
  },
  {
    id: 'societyEvent-15-19th-south-african-national-orchid-show',
    path: 'title',
    from: '19th South African National Orchid Show',
    to: NAME,
  },
  {
    id: 'showPage-01-national-show-landing',
    path: 'sections[2].body[0].children[0].text',
    from: 'Stellenbosch Flying Club, R44',
    to: `${VENUE}, R44`,
  },
  {
    id: 'showPage-01-national-show-landing',
    path: 'sections[0].body[1].children[0].text',
    from: 'Award Entries',
    to: 'Plant Entry',
  },
  {
    id: 'showPage-16-plan-your-visit',
    path: 'sections[1].body[0].children[0].text',
    from: 'Stellenbosch Flying Club, R44',
    to: `${VENUE}, R44`,
  },
  {
    id: 'showPage-17-faq',
    path: 'sections[1].body[1].children[0].text',
    from: 'the Stellenbosch Flying Club, R44',
    to: `${VENUE}, R44`,
  },
  {
    id: 'showExhibitorInfo',
    path: 'entryFormPendingNote',
    from: OLD_ENTRY_PHRASE,
    to: `the ${NAME}`,
  },
  {
    id: 'showExhibitorInfo',
    path: 'entryProcess.body[2].children[0].text',
    from: OLD_ENTRY_PHRASE,
    to: `the ${NAME}`,
  },
  {
    id: 'showExhibitorInfo',
    path: 'fees.body[0].children[0].text',
    from: OLD_ENTRY_PHRASE,
    to: `the ${NAME}`,
  },
  {
    id: 'showExhibitorInfo',
    path: 'intro',
    from: 'the 19th South African National Orchid Show',
    to: `the ${NAME}`,
  },
  {
    id: 'showExhibitorStep-enter',
    path: 'body[0].children[0].text',
    from: OLD_ENTRY_PHRASE,
    to: `the ${NAME}`,
  },
];

function readEnvLocal() {
  const raw = readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[trimmed.slice(0, eq).trim()] = value;
  }
  return out;
}

/** Read a Sanity-style path (a.b[2].c) from a document. */
function readPath(doc, fieldPath) {
  const tokens = fieldPath.match(/[^.[\]]+/g) ?? [];
  let cursor = doc;
  for (const token of tokens) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = cursor[/^\d+$/.test(token) ? Number(token) : token];
  }
  return cursor;
}

function snippet(text, needle) {
  const at = text.indexOf(needle);
  const start = Math.max(0, (at < 0 ? 0 : at) - 20);
  return JSON.stringify(text.slice(start, start + SNIPPET_LENGTH));
}

/** Decide what to do with one (document, patch). */
function plan(doc, patch) {
  const current = readPath(doc, patch.path);
  if (typeof current !== 'string') return { verdict: 'drift', note: 'path is not a string' };
  if (current.includes(patch.from)) {
    return { verdict: 'patch', before: current, after: current.replace(patch.from, patch.to) };
  }
  if (current.includes(patch.to)) return { verdict: 'already applied', before: current };
  return { verdict: 'drift', before: current };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const env = readEnvLocal();
  if (env.NEXT_PUBLIC_SANITY_PROJECT_ID !== EXPECTED_PROJECT_ID) {
    console.error(`refusing: project is not ${EXPECTED_PROJECT_ID}`);
    process.exit(1);
  }
  if (!env.SANITY_API_TOKEN) {
    console.error('refusing: SANITY_API_TOKEN is not set in .env.local');
    process.exit(1);
  }
  const client = createClient({
    projectId: EXPECTED_PROJECT_ID,
    dataset: env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: API_VERSION,
    token: env.SANITY_API_TOKEN,
    useCdn: false,
    perspective: 'raw',
  });

  const ids = [...new Set(PATCHES.map((p) => p.id))];
  const counts = { patched: 0, skipped: 0, drift: 0, missing: 0 };
  console.log(apply ? 'MODE: APPLY' : 'MODE: DRY RUN (pass --apply to write)');

  for (const baseId of ids) {
    const ops = PATCHES.filter((p) => p.id === baseId);
    for (const docId of [baseId, `drafts.${baseId}`]) {
      const doc = await client.getDocument(docId);
      if (!doc) {
        if (docId === baseId) {
          counts.missing += 1;
          console.log(`${docId}: MISSING published document`);
        }
        continue;
      }
      const set = {};
      for (const op of ops) {
        const result = plan(doc, op);
        console.log(`${docId} :: ${op.path} -> ${result.verdict}`);
        if (result.verdict === 'patch') {
          console.log(`    before ${snippet(result.before, op.from)}`);
          console.log(`    after  ${snippet(result.after, op.to)}`);
          set[op.path] = result.after;
          counts.patched += 1;
        } else if (result.verdict === 'already applied') {
          counts.skipped += 1;
        } else {
          counts.drift += 1;
          if (result.before !== undefined) console.log(`    found  ${snippet(result.before, '')}`);
        }
      }
      if (apply && Object.keys(set).length > 0) {
        await client.transaction().patch(docId, (p) => p.set(set)).commit();
        console.log(`${docId}: written (${Object.keys(set).length} path(s))`);
      }
    }
  }

  console.log(
    `summary: ${counts.patched} to patch/patched, ${counts.skipped} already applied, ` +
      `${counts.drift} drift, ${counts.missing} missing`,
  );
  if (counts.drift > 0 || counts.missing > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
