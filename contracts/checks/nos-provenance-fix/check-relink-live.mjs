#!/usr/bin/env node
// nos-provenance-fix F3 — lead condition 2: the production write changes the sourcePath field
// of the three approved sections and NOTHING else in the dataset's showPage documents.
//
// Usage (READ-ONLY; never writes to Sanity):
//   node contracts/checks/nos-provenance-fix/check-relink-live.mjs snapshot <worktree> <before.json>
//   node contracts/checks/nos-provenance-fix/check-relink-live.mjs verify   <worktree> <before.json>
//
// `snapshot` (run immediately before the apply) records every showPage document in the raw
// perspective — published, drafts and the legacy dot-id duplicates — and refuses unless the
// three targets currently hold their pinned `from` paths. `verify` (run after the apply)
// re-reads the same set, writes <before-dir>/after.json, and passes only when the document
// set is identical and every document deep-equals its snapshot except _rev/_updatedAt and the
// three pinned sourcePath values, which must now equal their `to` paths.
// Reads NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET and a read token
// (SANITY_API_READ_TOKEN, else SANITY_API_TOKEN) from <worktree>/.env.local; prints no value.
// Exit 0 = pass, 1 = fail, 2 = could not run.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { RECOVERED } from './recovered-entries.mjs';

const [mode, wtArg, beforeArg] = process.argv.slice(2);
if (!['snapshot', 'verify'].includes(mode) || !wtArg || !beforeArg) {
  console.error('usage: check-relink-live.mjs snapshot|verify <worktree> <before.json>');
  process.exit(2);
}
const wt = path.resolve(wtArg);
const beforePath = path.resolve(beforeArg);
const envFile = path.join(wt, '.env.local');
if (!existsSync(envFile)) { console.error('check-relink-live: <worktree>/.env.local missing'); process.exit(2); }
const env = {};
for (const line of readFileSync(envFile, 'utf8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const token = env.SANITY_API_READ_TOKEN || env.SANITY_API_TOKEN;
if (!env.NEXT_PUBLIC_SANITY_PROJECT_ID || !env.NEXT_PUBLIC_SANITY_DATASET || !token) {
  console.error('check-relink-live: .env.local lacks the Sanity project id, dataset or a read token');
  process.exit(2);
}
const { createClient } = createRequire(path.join(wt, 'package.json'))('@sanity/client');
const client = createClient({
  projectId: env.NEXT_PUBLIC_SANITY_PROJECT_ID,
  dataset: env.NEXT_PUBLIC_SANITY_DATASET,
  apiVersion: '2024-01-01',
  token,
  useCdn: false,
  perspective: 'raw',
});

const TARGETS = RECOVERED.map((e) => ({ docId: `showPage-${e.pageKey}`, sectionKey: e.sectionKey, from: e.from, to: `${e.dir}/content.md` }));
const fetchAll = () => client.fetch('*[_type == "showPage"] | order(_id asc)');
const strip = (d) => { const { _rev, _updatedAt, ...rest } = d; void _rev; void _updatedAt; return rest; };
const sectionOf = (doc, key) => (doc?.sections ?? []).filter((s) => s.sectionKey === key);

const docs = await fetchAll();
if (mode === 'snapshot') {
  const problems = [];
  for (const t of TARGETS) {
    const doc = docs.find((d) => d._id === t.docId);
    const secs = sectionOf(doc, t.sectionKey);
    if (!doc || secs.length !== 1) problems.push(`${t.docId}/${t.sectionKey}: missing or ambiguous`);
    else if (secs[0].sourcePath !== t.from) problems.push(`${t.docId}/${t.sectionKey}: sourcePath is not the pinned from-path`);
  }
  if (problems.length) { problems.forEach((p) => console.log(`FAIL ${p}`)); process.exit(1); }
  mkdirSync(path.dirname(beforePath), { recursive: true });
  writeFileSync(beforePath, JSON.stringify(docs, null, 2) + '\n');
  console.log(`snapshot: ${docs.length} showPage documents written to ${path.relative(process.cwd(), beforePath)}`);
  for (const t of TARGETS) {
    const doc = docs.find((d) => d._id === t.docId);
    console.log(`BEFORE ${t.docId}/${t.sectionKey} rev=${doc._rev} sourcePath=${sectionOf(doc, t.sectionKey)[0].sourcePath}`);
  }
  process.exit(0);
}

if (!existsSync(beforePath)) { console.error('check-relink-live: no before snapshot — run snapshot before the apply'); process.exit(2); }
const before = JSON.parse(readFileSync(beforePath, 'utf8'));
writeFileSync(path.join(path.dirname(beforePath), 'after.json'), JSON.stringify(docs, null, 2) + '\n');

const failures = [];
const idsBefore = before.map((d) => d._id).join(',');
const idsAfter = docs.map((d) => d._id).join(',');
if (idsBefore !== idsAfter) failures.push(`document set changed: before [${idsBefore}] after [${idsAfter}]`);

const expected = new Map(before.map((d) => [d._id, JSON.parse(JSON.stringify(strip(d)))]));
for (const t of TARGETS) {
  const exp = expected.get(t.docId);
  const secs = sectionOf(exp, t.sectionKey);
  if (secs.length === 1) secs[0].sourcePath = t.to;
  else failures.push(`${t.docId}/${t.sectionKey}: not exactly one section in the snapshot`);
}
for (const d of docs) {
  const exp = expected.get(d._id);
  if (exp && JSON.stringify(exp) !== JSON.stringify(strip(d))) failures.push(`${d._id}: differs from snapshot beyond the pinned sourcePath change`);
}
for (const t of TARGETS) {
  const b = before.find((d) => d._id === t.docId);
  const a = docs.find((d) => d._id === t.docId);
  const bs = sectionOf(b, t.sectionKey)[0]?.sourcePath;
  const as = sectionOf(a, t.sectionKey)[0]?.sourcePath;
  console.log(`${t.docId}/${t.sectionKey}: rev ${b?._rev} -> ${a?._rev}; sourcePath ${bs} -> ${as}`);
  if (as !== t.to) failures.push(`${t.docId}/${t.sectionKey}: sourcePath is not the pinned to-path`);
}
if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
console.log(`PASS: ${docs.length} showPage documents unchanged except the 3 pinned sourcePath values`);
