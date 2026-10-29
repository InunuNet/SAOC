// council-copy-fixes A4 "no other string changes": every changed line against origin/main is exactly a copy-map substitution.
//  - sourceFiles and pinFiles: `git diff -U0` removed lines, with every before->after (and pinSubs) substitution applied, must equal the added
//    lines, pairwise and in order; a hunk with unequal -/+ counts fails.
//  - plumbingFiles (the nos-content-standard gate scripts taught the overrides): normalised back to origin/main by check-plumbing.mjs and then BYTE-EQUAL; a
//    deleted assertion, a removed route or any other edit fails. No line-level exemption.
//  - looseFiles (text pins and goldens) and the council spec dir, docs/ and the new overrides file are allowed any change.
//  - any other changed path fails.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { checkPlumbing } from './check-plumbing.mjs';

const MAP = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/copy-map.json', 'utf8'));
const BASE = process.env.COUNCIL_DIFF_BASE ?? 'origin/main';
const git = (args) => { const r = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); if (r.status !== 0) { console.error(r.stderr); process.exit(2); } return r.stdout; };
const subs = [...MAP.entries.map((e) => [e.before, e.after]), ...MAP.pinSubs.map((p) => [p.from, p.to])];
const apply = (s) => subs.reduce((acc, [from, to]) => acc.split(from).join(to), s);
const AFTER_FILES = new Set(MAP.entries.map((e) => e.file));
const strict = new Set([...MAP.sourceFiles, ...MAP.pinFiles]);
const loose = new Set(MAP.looseFiles);
const allowedPrefixes = ['.agent/memory/project/specs/council-1028/', 'docs/', '.agent/memory/project/missions/', '.agent/memory/project/learned.md', '.agent/memory/project/backlog.md'];
const fails = [];

const changed = git(['diff', '--name-only', `${BASE}...HEAD`]).split('\n').filter(Boolean);
for (const file of changed) {
  if (MAP.plumbingFiles.includes(file)) { fails.push(...checkPlumbing(file, git(['show', `HEAD:${file}`]), git(['show', `${BASE}:${file}`]))); continue; }
  if (loose.has(file) || allowedPrefixes.some((p) => file.startsWith(p))) continue;
  if (!strict.has(file)) { fails.push(`${file}: changed but not a listed source, pin or plumbing file`); continue; }
  const patch = git(['diff', '-U0', `${BASE}...HEAD`, '--', file]);
  let minus = []; let plus = [];
  const flush = (at) => {
    if (minus.length !== plus.length) fails.push(`${file} @${at}: ${minus.length} removed vs ${plus.length} added lines`);
    else minus.forEach((m, i) => { if (apply(m) !== plus[i]) fails.push(`${file} @${at}: line is not a pure copy-map substitution:\n      - ${m.slice(0, 200)}\n      + ${plus[i].slice(0, 200)}`); });
    minus = []; plus = [];
  };
  let at = '?';
  for (const l of patch.split('\n')) {
    if (l.startsWith('@@')) { flush(at); at = l.split(' ')[2]; }
    else if (l.startsWith('---') || l.startsWith('+++')) continue;
    else if (l.startsWith('-')) minus.push(l.slice(1));
    else if (l.startsWith('+')) plus.push(l.slice(1));
  }
  flush(at);
  if (AFTER_FILES.has(file) && !patch) fails.push(`${file}: listed in the copy map but not changed`);
}
for (const f of MAP.sourceFiles) if (!changed.includes(f)) fails.push(`${f}: a source file in the copy map is not changed`);
if (fails.length) { console.error(`FAIL diff-scope: ${fails.length}`); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log(`PASS diff-scope: ${changed.length} changed paths, every strict file a pure substitution`);
