// Scope guard (guards the dev diff): no hex colour literal is ADDED under app/, components/ or lib/ except the three
// ruled status values and the one ruled on-dark token. No invented colours (docs/rules/no-invention.md): everything else must reuse an existing token.
import { execFileSync } from 'node:child_process';
import { check, finish } from './lib.mjs';
const ALLOWED = new Set(['#8f2834', '#2f5d3a', '#7a5a12', '#e8959d']); // #e8959d: --status-error-on-dark, NOS Design ruling (6.62:1 on #22281f), measured on that ground only
// The diff is taken against an explicit base: SDC_BASE_REF or `--base=<ref>`, defaulting to `git merge-base HEAD origin/main`. A diff against origin/main inspects nothing once the branch is merged, so an empty diff
// (0 added lines inspected) FAILS, never passes silently, unless --allow-empty is passed. The count is always printed.
const argBase = process.argv.find((a) => a.startsWith('--base='));
const base = process.env.SDC_BASE_REF || (argBase ? argBase.slice('--base='.length) : execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim());
const diff = execFileSync('git', ['diff', '-U0', base, '--', 'app', 'components', 'lib'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let added = 0;
for (const line of diff.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  added++;
  for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) check(ALLOWED.has(m[0].toLowerCase()), `added colour literal ${m[0]}: ${line.slice(1, 90).trim()}`);
}
console.log(`no-new-colours: inspected ${added} added line(s) against ${base.slice(0, 12)}`);
check(added > 0 || process.argv.includes('--allow-empty'), `inspected 0 added lines against ${base.slice(0, 12)}: the diff is empty, so nothing was proven (pass --allow-empty to accept an empty diff)`);
finish('no-new-colours');
