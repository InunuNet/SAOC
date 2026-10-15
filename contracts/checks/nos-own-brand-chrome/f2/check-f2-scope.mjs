// F2-S: the diff against base (F1 + F2 together, F1 being uncommitted) touches only goldens/f2/scope-allowlist.json files.
// Supersedes F1's A13 for the F2 run (A13 reads F1's narrower allowlist and would reject every F2 page edit by design).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { BASE_REF, F2_GOLDEN_DIR } from './_f2lib.mjs';

const allow = JSON.parse(readFileSync(`${F2_GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const sh = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = new Set([...sh(['diff', '--name-only', '--no-renames', BASE_REF]), ...sh(['ls-files', '--others', '--exclude-standard'])]);
const rules = allow.allowed.map((g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$'));
const stray = [...changed].filter((f) => !rules.some((re) => re.test(f)));
if (stray.length) {
  console.error(`FAIL F2-S scope: ${stray.length} file(s) outside the allowlist:`);
  for (const f of stray) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS F2-S scope (${changed.size} changed file(s), all allowed)`);
