// F3-S: the diff against base (F1 + F2 + F3 together) touches only goldens/f3/scope-allowlist.json files (= the F2 allowlist). SAOC /og (lib/seo.ts, app/og/route.tsx),
// components/vendors/**, components/ui/** and app/globals.css stay untouched. Supersedes F2-S for the F3 run (same list, so F2-S would also hold).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { BASE_REF, F3_GOLDEN_DIR } from './_f3lib.mjs';

const allow = JSON.parse(readFileSync(`${F3_GOLDEN_DIR}/scope-allowlist.json`, 'utf8'));
const sh = (args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
const changed = new Set([...sh(['diff', '--name-only', '--no-renames', BASE_REF]), ...sh(['ls-files', '--others', '--exclude-standard'])]);
const rules = allow.allowed.map((g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*') + '$'));
const stray = [...changed].filter((f) => !rules.some((re) => re.test(f)));
if (stray.length) {
  console.error(`FAIL F3-S scope: ${stray.length} file(s) outside the allowlist:`);
  for (const f of stray) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS F3-S scope (${changed.size} changed file(s), all allowed)`);
