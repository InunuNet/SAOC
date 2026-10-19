// F31-A6 - every changed file is on the F31 allowlist. Base is BASE_REF (default origin/main).
// Run from the repo root: node contracts/checks/launch-weekend/f31/check-f-scope.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const allow = JSON.parse(readFileSync('.agent/memory/project/specs/launch-weekend/goldens/f31/scope-allowlist.json', 'utf8'));
const base = process.env[allow.baseRefEnv] || allow.baseRefDefault;
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).split('\n').filter(Boolean);
let mergeBase;
try { mergeBase = git('merge-base', 'HEAD', base)[0]; } catch { console.error(`INFRA: cannot resolve ${base}`); process.exit(2); }
const changed = new Set([...git('diff', '--name-only', mergeBase), ...git('ls-files', '--others', '--exclude-standard')]);
const patterns = allow.allowed.map((p) => new RegExp(p));
const stray = [...changed].filter((f) => !patterns.some((re) => re.test(f)));
if (stray.length > 0) { console.error(`FAIL F31-A6: files outside the allowlist:\n - ${stray.join('\n - ')}`); process.exit(1); }
console.log(`PASS F31-A6 scope (${changed.size} changed files, all allowed)`);
