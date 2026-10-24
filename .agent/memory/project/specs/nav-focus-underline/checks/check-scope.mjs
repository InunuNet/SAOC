// nav-focus-underline -- scope guard: only the files this fix owns may differ from main. Run from the project root: node <this file>
// Covers: skip links unchanged, buttons/fields untouched (component files other than the chrome ones are off limits).
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';

if (process.env.CHECK_ROOT) process.chdir(process.env.CHECK_ROOT); // only for running outside the project root (e.g. from another worktree)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
// origin/main first: a stale local main would make an already-merged PR look like this fix's diff.
const baseRef = (() => { try { git('rev-parse', '--verify', 'origin/main'); return 'origin/main'; } catch { return 'main'; } })();
const base = git('merge-base', 'HEAD', baseRef);
const changed = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
].filter(Boolean));

// Allow-lists are per feature (checks/scope-f<N>.json: regex strings plus mustStay paths), merged, so a later feature adds its own
// file instead of editing an earlier feature's list. A later feature may release an earlier feature's frozen path ("release") and allow it; F2 releases footer-data.ts for the email move.
const dir = new URL('.', import.meta.url).pathname;
const lists = readdirSync(dir).filter((f) => /^scope-f\d+\.json$/.test(f)).map((f) => JSON.parse(readFileSync(dir + f, 'utf8')));
const ALLOWED = lists.flatMap((l) => l.allowed).map((s) => new RegExp(s));
const RELEASED = new Set(lists.flatMap((l) => l.release ?? []));
const MUST_STAY = lists.flatMap((l) => l.mustStay).filter((f) => !RELEASED.has(f));

const failures = [];
for (const f of changed) {
  if (MUST_STAY.includes(f)) failures.push(`${f} must stay unchanged (skip link, form fields and nav data are out of scope)`);
  else if (!ALLOWED.some((re) => re.test(f))) failures.push(`${f} is outside this fix's scope`);
}
if (failures.length) { console.error(`FAIL\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log(`scope ok (${changed.size} changed paths since ${base.slice(0, 8)})`);
