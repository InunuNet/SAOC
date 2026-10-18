// nos-critique-r15 f1 unit (QA input, hash-locked): runs lib/data/society-withhold.ts (Node type stripping; the helper is import-free,
// f1-static S1) against goldens/f1-withhold.json unitCases.
//   withhold false -> the very same object (beta byte-unchanged); withhold true -> founded/memberCount nulled and their flag cleared ONLY
//   where that field's own placeholder flag is true; sourced values (flag false, null or absent) and every other field pass through.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { finish, goldenJson, repoRoot } from './_lib.mjs';

const NAME = 'f1-unit.mjs';
const failures = [];
const G = goldenJson('f1-withhold.json');
let fn;
try {
  ({ withholdSocietyEstimates: fn } = await import(pathToFileURL(path.join(repoRoot, 'lib/data/society-withhold.ts')).href));
} catch (e) {
  finish(NAME, [`cannot import lib/data/society-withhold.ts: ${e.message}`]);
}
if (typeof fn !== 'function') finish(NAME, ['withholdSocietyEstimates is not exported as a function']);
for (const c of G.unitCases) {
  const input = structuredClone(c.in);
  const frozen = structuredClone(c.in);
  let out;
  try { out = fn(input, c.withhold); } catch (e) { failures.push(`${c.id}: threw ${e.message}`); continue; }
  if (!isDeepStrictEqual(input, frozen)) failures.push(`${c.id}: mutated its input`);
  if (c.same) { if (out !== input) failures.push(`${c.id}: did not return the same object`); continue; }
  if (!isDeepStrictEqual(out, c.out)) failures.push(`${c.id}: got ${JSON.stringify(out)}, want ${JSON.stringify(c.out)}`);
}
finish(NAME, failures, `${G.unitCases.length} withholdSocietyEstimates cases hold (beta returns the same object; only flagged estimates withheld).`);
