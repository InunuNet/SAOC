// nos-critique-r17 F2 static (QA input, hash-locked). Goldens: goldens/f2-logo.json, f2-footprint.json.
//   S1  components/nos-chrome/NosFooter.tsx no longer renders the SAOC eyebrow (FOOTER_ORG_NAME) or paragraph (FOOTER_BRAND_TEXT): neither
//       is imported or referenced; FOOTER_REG still renders; the alt stays the existing LOCKUP_ALT; neither old lockup file is referenced.
//   S2  components/chrome/footer-data.ts equals BASE minus exactly the dead FOOTER_BRAND_TEXT export (lead ruling 2026-10-19, amendment;
//       golden deadExport.dropLines); FOOTER_REG stays exactly "REG# 1978/004040/08   NPO 043-901" with its three no-break spaces.
//   S6  FOOTER_BRAND_TEXT has 0 references left in the golden search roots (tracked and untracked files).
//   S3  the chosen vertical logo (goldens/f2-logo.json `chosen`: GOLD, Codi FINAL 2026-10-19) is referenced by NosFooter.tsx and its
//       public/images copy hashes to the golden sha256. No committed change under branding/.
//   S4  NO INVENTION: no new prose literal in the F2 files.  S5  docs/nos-critique-r17.md has a "## F2" section.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { BASE, DOC, finish, git, goldenJson, readRepoFile, repoRoot } from './_lib.mjs';
import { exactEdits, newProse } from './_edits.mjs';

const NAME = 'f2-static.mjs';
const G = goldenJson('f2-logo.json');
const FP = goldenJson('f2-footprint.json');
const failures = [];
const src = readRepoFile(G.file) ?? '';

// S1
for (const c of [G.removed.eyebrowConst, G.removed.paragraphConst]) if (new RegExp(`\\b${c}\\b`).test(src)) failures.push(`${G.file}: still references ${c} (S1)`);
if (!/\{FOOTER_REG\}/.test(src)) failures.push(`${G.file}: no longer renders {FOOTER_REG} (S1)`);
if (!src.includes(`const LOCKUP_ALT = '${G.alt}';`)) failures.push(`${G.file}: LOCKUP_ALT is no longer '${G.alt}' (S1)`);
for (const p of G.removed.oldImages) if (src.includes(p)) failures.push(`${G.file}: still references ${p} (S1)`);

// S2
failures.push(...exactEdits(G.deadExport.file, [], [G.deadExport.dropLines], 'S2'));
if (!(readRepoFile(G.reg.file) ?? '').includes(`export const ${G.reg.const} = '${G.reg.text}';`)) failures.push(`${G.reg.file}: ${G.reg.const} is not '${G.reg.text}' (S2)`);

// S3
if (!G.chosen) failures.push(`goldens/f2-logo.json: chosen is null, no logo chosen among ${Object.values(G.candidates).map((c) => path.basename(c.source)).join(' and ')} (S3)`);
else {
  if (!src.includes(`'${G.chosen.path}'`)) failures.push(`${G.file}: does not reference '${G.chosen.path}' (S3)`);
  const abs = path.join(repoRoot, G.chosen.dest);
  const got = existsSync(abs) ? createHash('sha256').update(readFileSync(abs)).digest('hex') : null;
  if (got !== G.chosen.sha256) failures.push(`${G.chosen.dest}: sha256 ${got}, want ${G.chosen.sha256} (S3)`);
}
for (const p of git('diff', '--name-only', BASE, 'HEAD').split('\n').filter(Boolean)) if (p.startsWith('branding/')) failures.push(`${p}: branding/ must not change on this branch (S3)`);

// S4
for (const f of FP) failures.push(...newProse(f, FP));

// S5
if (!/^## F2\b/m.test(readRepoFile(DOC) ?? '')) failures.push(`${DOC}: no "## F2" section (S5)`);

// S6
let refs = '';
try { refs = git('grep', '-n', '--untracked', '-w', G.deadExport.const, '--', ...G.deadExport.searchRoots); } catch { refs = ''; }
const hits = refs.split('\n').filter(Boolean);
if (hits.length !== G.deadExport.references) failures.push(`${G.deadExport.const}: ${hits.length} reference(s) left, want ${G.deadExport.references}: ${hits.slice(0, 3).join(' | ')} (S6)`);

finish(NAME, failures, 'F2 static: NOS footer drops the SAOC eyebrow and paragraph, the dead FOOTER_BRAND_TEXT export is gone with 0 references, REG/NPO and the alt kept, the chosen byte-identical vertical logo, no new copy, docs F2.');
