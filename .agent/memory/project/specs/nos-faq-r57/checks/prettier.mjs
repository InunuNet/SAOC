// nos-faq-r57 (r57) prettier check. QA input, hash-locked. origin/main already fails `prettier --check` on nos-chrome.css and
// VendorApplyForm.tsx, and reformatting them is out of scope. So: a file clean at BASE must stay clean; a file already dirty at BASE must not
// get dirtier. Dirtiness = the number of lines prettier would change (original lines missing from the formatted output plus formatted lines
// missing from the original, as multisets), computed for the BASE copy and the working copy with the repo's own prettier config.
import { createRequire } from 'node:module';
import path from 'node:path';

import { finish, goldenJson, readBaseFile, readRepoFile, repoRoot } from './_lib.mjs';

const require = createRequire(path.join(repoRoot, 'package.json'));
const prettier = require('prettier');
const files = goldenJson('footprint.json');
const failures = [];

const tally = (text) => { const m = new Map(); for (const l of text.split('\n')) m.set(l, (m.get(l) ?? 0) + 1); return m; };
async function dirt(text, config) {
  const formatted = await prettier.format(text, config);
  const a = tally(text), b = tally(formatted);
  let n = 0;
  for (const [l, c] of a) n += Math.max(0, c - (b.get(l) ?? 0));
  for (const [l, c] of b) n += Math.max(0, c - (a.get(l) ?? 0));
  return n;
}

const results = [];
for (const rel of files) {
  const head = readRepoFile(rel);
  const base = readBaseFile(rel);
  if (head === null) { failures.push(`${rel} is missing`); continue; }
  const config = { ...(await prettier.resolveConfig(path.join(repoRoot, rel))), filepath: path.join(repoRoot, rel) };
  const h = await dirt(head, config);
  const b = base === null ? 0 : await dirt(base, config);
  results.push(`${rel}: base ${b}, now ${h}`);
  if (h > b) failures.push(`${rel}: prettier would change ${h} line(s), the base copy needed ${b}: the diff adds formatting violations`);
}
finish('prettier.mjs', failures, `no file got dirtier than its base (${results.join('; ')}).`);
