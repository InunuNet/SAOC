#!/usr/bin/env node
// F4 (cms-activation-deploy): POSITIVE-PATH assertion that the six page-singleton
// documents were actually seeded with the migrated copy, not just "no error occurred".
// This is the check F2 taught us to write — the six F2 assertions that shipped a
// broken deploy all tested the negative path only (Athanor learning, mission notes).
//
// Loads every *.golden.json in contracts/golden/f4-seed-page-singletons/, fetches the
// live document at the pinned _id (F3's convention: _id === schema type name) from the
// real Sanity dataset, and validates each declared field per its "kind":
//   - "exact"      scalar (string/boolean/number) must deep-equal golden.value
//   - "exactArray" array of plain objects must deep-equal golden.value (Sanity's
//                  auto-added _key on array items is stripped before comparing)
//   - "portableText" array of portable-text blocks; plain text is extracted (all
//                  span text, blocks joined by "\n", trimmed) and compared to
//                  golden.value as a string — ignores Sanity's random _key/_type ids
//   - "image"      single image field: _type === "image" and asset._ref matches
//                  /^image-/ — does not compare exact asset ids (non-deterministic
//                  per upload)
//   - "imageArray" array of image fields; length >= golden.minCount, every item
//                  passes the same "image" structural check
//   - "absent"     field must be null/undefined/empty-string/empty-array — proves a
//                  documented gap was NOT quietly papered over with invented content
//
// A missing token, an unreachable API, or a missing document is a HARD FAIL (never a
// skip) — Athanor#1322 is exactly a SKIP silently reporting as PASS.
//
// Run as: node --import tsx/esm contracts/checks/f4-seed-page-singletons/check-seed-content.mjs
// Requires SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local.
//
// Exit codes: 0 = every field in every golden file matches. 1 = any mismatch, any
// missing document, or any infrastructure failure (credentials/network/query error).

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createClient } from '@sanity/client';
import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = path.resolve(__dirname, '../../golden/f4-seed-page-singletons');

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const token = process.env.SANITY_API_READ_TOKEN || process.env.SANITY_API_TOKEN;

if (!projectId || !dataset || !token) {
  console.error(
    'FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN (or SANITY_API_TOKEN) in .env.local'
  );
  process.exit(1);
}

const client = createClient({ projectId, dataset, apiVersion: '2024-01-01', token, useCdn: false });

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function stripKeys(obj) {
  if (Array.isArray(obj)) return obj.map(stripKeys);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '_key') continue;
      out[k] = stripKeys(v);
    }
    return out;
  }
  return obj;
}

function portableTextToPlain(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => (Array.isArray(b?.children) ? b.children.map((c) => c?.text ?? '').join('') : ''))
    .join('\n')
    .trim();
}

function isValidImageRef(img) {
  return (
    img &&
    typeof img === 'object' &&
    img._type === 'image' &&
    img.asset &&
    typeof img.asset._ref === 'string' &&
    /^image-/.test(img.asset._ref)
  );
}

function checkField(docId, fieldName, spec, actual, failures) {
  switch (spec.kind) {
    case 'exact': {
      if (actual !== spec.value) {
        failures.push(
          `${docId}.${fieldName}: expected ${JSON.stringify(spec.value)}, got ${JSON.stringify(actual)}`
        );
      }
      break;
    }
    case 'exactArray': {
      const got = JSON.stringify(stripKeys(actual ?? null));
      const want = JSON.stringify(stripKeys(spec.value));
      if (got !== want) {
        failures.push(`${docId}.${fieldName}: expected ${want}, got ${got}`);
      }
      break;
    }
    case 'portableText': {
      const plain = portableTextToPlain(actual);
      if (plain !== spec.value) {
        failures.push(
          `${docId}.${fieldName}: expected portableText plain text ${JSON.stringify(spec.value)}, got ${JSON.stringify(plain)}`
        );
      }
      break;
    }
    case 'image': {
      if (!isValidImageRef(actual)) {
        failures.push(`${docId}.${fieldName}: expected a valid Sanity image reference, got ${JSON.stringify(actual)}`);
      }
      break;
    }
    case 'imageArray': {
      if (!Array.isArray(actual) || actual.length < spec.minCount) {
        failures.push(
          `${docId}.${fieldName}: expected an array of at least ${spec.minCount} images, got ${JSON.stringify(actual)}`
        );
        break;
      }
      actual.forEach((item, i) => {
        if (!isValidImageRef(item)) {
          failures.push(`${docId}.${fieldName}[${i}]: not a valid Sanity image reference — ${JSON.stringify(item)}`);
        }
      });
      break;
    }
    case 'absent': {
      if (!isEmpty(actual)) {
        failures.push(
          `${docId}.${fieldName}: expected absent/empty (documented gap — do not invent content), got ${JSON.stringify(actual)}`
        );
      }
      break;
    }
    default:
      failures.push(`${docId}.${fieldName}: unknown golden "kind" ${JSON.stringify(spec.kind)} — fix the golden file`);
  }
}

let goldenFiles;
try {
  goldenFiles = readdirSync(GOLDEN_DIR).filter((f) => f.endsWith('.golden.json'));
} catch (err) {
  console.error(`FAIL: could not read golden directory ${GOLDEN_DIR} — ${err.message}`);
  process.exit(1);
}

if (goldenFiles.length === 0) {
  console.error(`FAIL: no golden files found in ${GOLDEN_DIR}`);
  process.exit(1);
}

const failures = [];
let checkedDocs = 0;
let checkedFields = 0;

for (const file of goldenFiles.sort()) {
  const golden = JSON.parse(readFileSync(path.join(GOLDEN_DIR, file), 'utf8'));
  const docId = golden._id;

  let doc;
  try {
    doc = await client.fetch(`*[_id == $id][0]`, { id: docId });
  } catch (err) {
    console.error(`FAIL: GROQ query for _id == "${docId}" threw — ${err.message}`);
    process.exit(1);
  }

  if (!doc) {
    failures.push(`${docId}: document does not exist at the pinned id — 0 documents seeded (hard fail, not a skip)`);
    continue;
  }
  checkedDocs += 1;

  if (doc._type !== golden._type) {
    failures.push(`${docId}: expected _type "${golden._type}", got "${doc._type}"`);
  }

  for (const [fieldName, spec] of Object.entries(golden.fields ?? {})) {
    checkField(docId, fieldName, spec, doc[fieldName], failures);
    checkedFields += 1;
  }
}

console.log(`Checked ${checkedDocs}/${goldenFiles.length} documents, ${checkedFields} fields.`);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: all six singletons exist at their pinned ids with the migrated field values.');
process.exit(0);
