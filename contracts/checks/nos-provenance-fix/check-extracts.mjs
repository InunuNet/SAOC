#!/usr/bin/env node
// nos-provenance-fix F3 — the three recovered sources are exact, minimal, verbatim extracts.
//
// Usage: node contracts/checks/nos-provenance-fix/check-extracts.mjs <worktree> <nosRoot>
//
// For each entry in recovered-entries.mjs:
//   1. the recovery dir holds exactly content.md + recovery.json (no manifest, no .docx);
//   2. content.md is byte-identical to the architect's golden extract;
//   3. recovery.json is exactly the pinned object (method, md5, path, note);
//   4. the seed section is council-supplied, points at the new content.md, and its body
//      sentences map 1:1, in order, onto the extract's paragraphs (nothing more, nothing less);
//   5. when the gitignored source is present (<nosRoot>/content/drive-source), every
//      paragraph is a byte-exact substring of it and its manifest md5 equals sourceMd5.
// Exit 0 = pass, 1 = fail, 2 = could not run.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RECOVERED, RECOVERY_METHOD, RECOVERED_AT, RECOVERED_BY, bodySentences, normalizeForLinkage } from './recovered-entries.mjs';

const [worktreeArg, nosRootArg] = process.argv.slice(2);
if (!worktreeArg || !nosRootArg) {
  console.error('usage: check-extracts.mjs <worktree> <nosRoot>');
  process.exit(2);
}
const wt = path.resolve(worktreeArg);
const nos = path.resolve(nosRootArg);
const goldenDir = path.join(nos, '.agent/memory/project/specs/nos-provenance-fix/goldens/f3-extracts');

export function expectedNote(e) {
  return (
    `Verbatim extract of ${e.source}: only the ${e.sentences} sentences the published section body quotes, ` +
    'each byte-identical to the source and in source order, one per paragraph. Everything else in the source ' +
    'is omitted (public-repo condition, nos-provenance-fix F3). No .docx or manifest is copied.'
  );
}

const failures = [];
const fail = (e, msg) => failures.push(`${e.pageKey}: ${msg}`);
let sourceChecked = 0;

for (const e of RECOVERED) {
  const dir = path.join(wt, e.dir);
  if (!existsSync(dir)) { fail(e, `missing ${e.dir}`); continue; }
  const names = readdirSync(dir).sort();
  if (JSON.stringify(names) !== JSON.stringify(['content.md', 'recovery.json'])) fail(e, `dir must hold exactly content.md + recovery.json, has ${names.join(', ')}`);

  const extract = existsSync(path.join(dir, 'content.md')) ? readFileSync(path.join(dir, 'content.md')) : Buffer.alloc(0);
  const golden = readFileSync(path.join(goldenDir, e.golden));
  if (!extract.equals(golden)) fail(e, 'content.md is not byte-identical to the golden extract');

  let rec = null;
  try { rec = JSON.parse(readFileSync(path.join(dir, 'recovery.json'), 'utf8')); } catch { fail(e, 'recovery.json missing or unparsable'); }
  if (rec) {
    const want = {
      specPage: e.specPage,
      sourceDrivePath: e.sourceDrivePath,
      sourceMd5: e.sourceMd5,
      method: RECOVERY_METHOD,
      recoveredAt: RECOVERED_AT,
      recoveredBy: RECOVERED_BY,
      supersededBy: null,
      note: expectedNote(e),
    };
    const keysWant = Object.keys(want).sort().join(',');
    const keysHave = Object.keys(rec).sort().join(',');
    if (keysWant !== keysHave) fail(e, `recovery.json keys ${keysHave} != ${keysWant}`);
    for (const [k, v] of Object.entries(want)) if (rec[k] !== v) fail(e, `recovery.json ${k} != pinned value`);
  }

  const paras = golden.toString('utf8').replace(/\n$/, '').split('\n\n');
  if (paras.length !== e.sentences) fail(e, `golden has ${paras.length} paragraphs, expected ${e.sentences}`);

  const seed = JSON.parse(readFileSync(path.join(wt, 'content/show-pages', `${e.pageKey}.json`), 'utf8'));
  const sec = (seed.sections ?? []).find((s) => s.sectionKey === e.sectionKey);
  if (!sec) { fail(e, `seed section ${e.sectionKey} missing`); continue; }
  if (sec.provenance !== 'council-supplied') fail(e, `seed provenance is ${sec.provenance}`);
  if (sec.sourcePath !== `${e.dir}/content.md`) fail(e, `seed sourcePath is ${sec.sourcePath}`);
  const sents = bodySentences(sec.body).map(normalizeForLinkage);
  const normParas = paras.map(normalizeForLinkage);
  if (JSON.stringify(sents) !== JSON.stringify(normParas)) fail(e, 'seed body sentences do not map 1:1, in order, onto the extract paragraphs');

  const src = path.join(nos, e.source);
  if (existsSync(src)) {
    sourceChecked += 1;
    const raw = readFileSync(src, 'utf8');
    paras.forEach((p, i) => { if (!raw.includes(p)) fail(e, `paragraph ${i + 1} is not a byte-exact substring of the source`); });
    const manifest = JSON.parse(readFileSync(path.join(path.dirname(src), 'manifest.json'), 'utf8'));
    if (manifest.md5_checksum !== e.sourceMd5) fail(e, `source manifest md5 ${manifest.md5_checksum} != pinned ${e.sourceMd5}`);
  }
}

console.log(`check-extracts: ${RECOVERED.length} entries, ${sourceChecked} verified against the gitignored source`);
if (failures.length) { failures.forEach((f) => console.log(`FAIL ${f}`)); process.exit(1); }
console.log('PASS: three exact, minimal, verbatim extracts with pinned recovery.json and seed linkage');
