// Scope guard (vacuous on main, guards the dev diff): no hex colour literal is ADDED under app/, components/ or lib/ except the three
// ruled status values. No invented colours (docs/rules/no-invention.md): everything else must reuse an existing token.
import { execFileSync } from 'node:child_process';
import { check, finish } from './lib.mjs';
const ALLOWED = new Set(['#8f2834', '#2f5d3a', '#7a5a12']);
const diff = execFileSync('git', ['diff', '-U0', 'origin/main', '--', 'app', 'components', 'lib'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
for (const line of diff.split('\n')) {
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  for (const m of line.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) check(ALLOWED.has(m[0].toLowerCase()), `added colour literal ${m[0]}: ${line.slice(1, 90).trim()}`);
}
finish('no-new-colours');
