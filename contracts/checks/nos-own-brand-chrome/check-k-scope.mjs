// K: the diff against base touches only the files the contract expects (scope-allowlist.json).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { BASE_REF, GOLDEN_DIR } from './_lib.mjs';

const allow = JSON.parse(readFileSync(`${GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const sh = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = new Set([...sh(['diff', '--name-only', '--no-renames', BASE_REF]), ...sh(['ls-files', '--others', '--exclude-standard'])]);
const rules = allow.allowed.map((g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$'));
const stray = [...changed].filter((f) => !rules.some((re) => re.test(f)));
if (stray.length) {
  console.error(`FAIL K scope: ${stray.length} file(s) outside the allowlist:`);
  for (const f of stray) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS K scope (${changed.size} changed file(s), all allowed)`);
