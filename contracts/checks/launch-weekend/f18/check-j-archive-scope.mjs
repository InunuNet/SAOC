#!/usr/bin/env node
// F18-A10: the static archive rule. The beta TBC card spans the column (no max-w-* on the card or its wrapper) in app/(nos)/national-show/archive/page.tsx.
//
// RETIRED 2026-11-22 (lead ruling): the scope and no-invention diff guards that used to live here (file allowlist, forbidden paths, no new
// binary image asset, no hex / rgb / font family / box-shadow / emoji in added lines, motion judged on added lines, no new user-visible
// sentence outside the base tree). They diffed against scopeBase() (merge-base(HEAD, main), never older than F18_BASE_REF), so they only
// described the F18 branch while it was open; on main they failed on unrelated later edits (or on "no F18 change found") and said nothing
// about the archive page. The motion-rule probes they also ran are covered by check-w-motion.mjs. See contract-f18.yaml.
//
// Usage: node contracts/checks/launch-weekend/f18/check-j-archive-scope.mjs   (cwd = repo root; reads one source file, no git, no network)
import { T, readText } from './_static.mjs';

const problems = [];
const arch = readText('app/(nos)/national-show/archive/page.tsx') ?? '';
if (!arch) problems.push('archive page missing');
else {
  const lines = arch.split('\n');
  const card = lines.findIndex((l) => l.includes(T.archive.emptyHeading));
  if (card < 0) problems.push(`archive: the beta TBC card ("${T.archive.emptyHeading}") is gone from the page`);
  for (let i = Math.max(0, card - 25); i <= card; i += 1) if (/max-w-(xl|2xl|3xl|4xl|5xl|prose|\[)/.test(lines[i] ?? '') && !/nos-wrap|container/.test(lines[i])) problems.push(`archive: line ${i + 1} still caps the TBC card width: "${lines[i].trim().slice(0, 80)}"`);
}
if (problems.length) { console.error(`FAIL F18-A10 (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS F18-A10 archive card width');
