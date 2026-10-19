// nos-critique-r16 F3 static (QA input, hash-locked). Goldens: goldens/f3-media.json, f3-events.json, f3-footprint.json.
//   S1  the media-kit page names exactly the three golden tiles, in order, and references each tile's public path; none of the retired
//       paper/brass lockups and not the old kit emblem /downloads/media-kit/saoc-emblem.png remain.
//   S2  every tile file in public/ is byte-identical to its golden sha256 (no recolour, no derivation). The lockup and dark-ground emblem
//       files are unchanged against BASE. emblemFull (8b) is the new public/images copy of the lead-staged emblem (lead ruling 2026-10-19,
//       sha256 pinned in the golden); nothing under branding/ may change.
//   S3  NO INVENTION: no new prose literal in the F3 files that is not already in BASE.
//   S4  docs/nos-critique-r16.md has a "## F3" section.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, DOC, changedPaths, finish, git, goldenJson, readRepoFile, repoRoot } from './_lib.mjs';
import { newProse } from './_edits.mjs';

const NAME = 'f3-static.mjs';
const M = goldenJson('f3-media.json');
const FP = goldenJson('f3-footprint.json');
const failures = [];
const sha = (abs) => (existsSync(abs) ? createHash('sha256').update(readFileSync(abs)).digest('hex') : null);
const OLD_EMBLEM = '/downloads/media-kit/saoc-emblem.png';

// S1
const src = readRepoFile(M.page) ?? '';
let cursor = -1;
for (const tile of M.tiles) {
  const at = src.indexOf(`'${tile.name}'`);
  if (at < 0) failures.push(`${M.page}: no tile named "${tile.name}" (S1)`);
  else if (at < cursor) failures.push(`${M.page}: tile "${tile.name}" is out of the golden order (S1)`);
  else cursor = at;
  const p = tile.path ?? (tile.dest ? `/${tile.dest.replace(/^public\//, '')}` : null);
  if (p && !src.includes(`'${p}'`)) failures.push(`${M.page}: tile "${tile.name}" does not reference ${p} (S1)`);
}
const names = [...src.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1]);
if (JSON.stringify(names) !== JSON.stringify(M.tiles.map((tile) => tile.name))) failures.push(`${M.page}: asset names ${JSON.stringify(names)}, want exactly ${JSON.stringify(M.tiles.map((tile) => tile.name))} (S1)`);
for (const r of M.retired) if (src.includes(r)) failures.push(`${M.page}: still references retired ${r} (S1)`);
if (src.includes(OLD_EMBLEM)) failures.push(`${M.page}: still references ${OLD_EMBLEM} (S1)`);

// S2
const changed = new Set(changedPaths());
for (const tile of M.tiles) {
  const file = tile.file ?? tile.dest;
  const got = sha(path.join(repoRoot, file));
  if (got !== tile.sha256) failures.push(`${file}: sha256 ${got}, want ${tile.sha256} (S2)`);
  if (!tile.newFile && changed.has(file)) failures.push(`${file}: changed against BASE (S2)`);
}
// Committed changes only: Brad's own uncommitted branding/ work in a checkout is his, not this branch's.
for (const p of git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)) if (p.startsWith('branding/')) failures.push(`${p}: branding/ is Brad's workstream and must not change on this branch (S2)`);

// S3
for (const f of FP) failures.push(...newProse(f, FP, { allow: M.tiles.map((tile) => tile.name) }));

// S4
if (!/^## F3\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F3" section (S4)`);

finish(NAME, failures, 'F3 static: three golden media-kit tiles in order, byte-identical files, retired set gone, no new copy, docs F3.');
