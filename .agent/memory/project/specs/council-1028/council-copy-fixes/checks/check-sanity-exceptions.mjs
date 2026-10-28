// council-copy-fixes: the Sanity-vs-Drive exception list. Every substitution's `from` appears exactly once in the frozen Drive FAQ mirror (so the
// list cannot drift from her words), `to` differs from `from`, every id is unique and every row names the council sheet. Once @dev creates
// nos-content-standard/goldens/council-overrides.json, it must also carry the same substitutions under `sanityExceptions` and `_lib.mjs` must gate them
// on the fixture's capturedAt (or NOS_STD_FIXTURE=live), so today's older fixture keeps the gates green.
import { readFileSync, existsSync } from 'node:fs';

const G = JSON.parse(readFileSync('.agent/memory/project/specs/council-1028/council-copy-fixes/goldens/sanity-exceptions.json', 'utf8'));
const norm = (s) => s.replace(/\s+/g, ' ');
const drive = norm(readFileSync(G.driveSourceFile, 'utf8'));
const fails = [];
const ids = new Set();
for (const s of G.substitutions) {
  if (ids.has(s.id)) fails.push(`${s.id}: duplicate id`); ids.add(s.id);
  if (s.from === s.to) fails.push(`${s.id}: from equals to`);
  const n = drive.split(norm(s.from)).length - 1;
  if (n !== 1) fails.push(`${s.id}: 'from' occurs ${n} times in ${G.driveSourceFile}, want exactly 1 (${s.from.slice(0, 50)})`);
  if (!s.sheet || !/2026-10-27/.test(s.sheet)) fails.push(`${s.id}: missing council sheet reference`);
}
if (!/^\d{4}-\d{2}-\d{2}T/.test(G.appliesFromFixtureCapturedAt)) fails.push('appliesFromFixtureCapturedAt is not an ISO timestamp');

const OV = '.agent/memory/project/specs/nos-content-standard/goldens/council-overrides.json';
if (!existsSync(OV)) fails.push(`${OV} does not exist yet (@dev creates it)`);
else {
  const ov = JSON.parse(readFileSync(OV, 'utf8')); const have = new Map((ov.sanityExceptions?.substitutions ?? []).map((x) => [x.id, x]));
  if (ov.sanityExceptions?.appliesFromFixtureCapturedAt !== G.appliesFromFixtureCapturedAt) fails.push(`${OV}: sanityExceptions.appliesFromFixtureCapturedAt missing or different`);
  for (const s of G.substitutions) { const h = have.get(s.id); if (!h || h.from !== s.from || h.to !== s.to) fails.push(`${OV}: sanityExceptions ${s.id} missing or different from the golden`); }
  const lib = readFileSync('.agent/memory/project/specs/nos-content-standard/checks/_lib.mjs', 'utf8');
  if (!/sanityExceptions/.test(lib) || !/capturedAt/.test(lib)) fails.push('nos-content-standard/checks/_lib.mjs does not gate sanityExceptions on the fixture capturedAt');
}
if (fails.length) { console.error(`FAIL sanity-exceptions: ${fails.length} problem(s)\n- ${fails.join('\n- ')}`); process.exit(1); }
console.log(`PASS sanity-exceptions: ${G.substitutions.length} Drive-vs-Sanity rows listed, each unique in the frozen mirror and wired into the overrides`);
