#!/usr/bin/env node
// A3 - anonymous read of the production dataset: the only published societyEvent is the National Show.
// Fails today: 18 published societyEvent docs. No token is used or needed (published docs are public).
// Usage: node contracts/checks/launch-weekend/f4/check-c-sanity-only-nos.mjs
import { readFileSync } from 'node:fs';
import { golden, KEEP, report } from './_lib.mjs';

let projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || golden.baseSanity.projectId;
if (!process.env.NEXT_PUBLIC_SANITY_PROJECT_ID) {
  try { const m = readFileSync('.env.local', 'utf8').match(/^NEXT_PUBLIC_SANITY_PROJECT_ID=["']?([^"'\n]+)/m); if (m) projectId = m[1]; } catch { /* fall back to golden */ }
}
const dataset = golden.baseSanity.dataset;
const url = `https://${projectId}.api.sanity.io/v2025-01-01/data/query/${dataset}?query=${encodeURIComponent('*[_type=="societyEvent"]{_id}')}`;
let body;
try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  body = await res.json();
} catch (e) { console.error(`INFRA: anonymous Sanity read failed (${e.message})`); process.exit(2); }

const ids = body.result.map((d) => d._id).sort();
const problems = [];
if (!ids.includes(KEEP.id)) problems.push(`the National Show event ${KEEP.id} is not published`);
for (const id of ids) if (id !== KEEP.id) problems.push(`still published: ${id}`);
report(problems, `only ${KEEP.id} is published (${ids.length} societyEvent doc)`);
