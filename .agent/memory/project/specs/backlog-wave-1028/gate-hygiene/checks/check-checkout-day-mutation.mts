// gate-hygiene item 3 (mutation proof): the checkout day-null check must FAIL when the route's day-selection guard is disabled.
// Rewrites app/api/tickets/checkout/route.ts in place, runs the check, restores byte-for-byte in a finally and on exit/signals.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROUTE = 'app/api/tickets/checkout/route.ts';
const CHECK = '.agent/memory/project/specs/backlog-wave-1028/gate-hygiene/checks/check-checkout-day-null.mts';
const GUARD = 'if (!lineItem.chosenDay) {';
const original = readFileSync(ROUTE, 'utf8');
if (!original.includes(GUARD)) { console.error(`FAIL\nguard anchor "${GUARD}" not found in ${ROUTE}`); process.exit(1); }
const restore = () => writeFileSync(ROUTE, original);
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { restore(); process.exit(130); });

const run = () => spawnSync('pnpm', ['exec', 'tsx', CHECK], { encoding: 'utf8' });
const base = run();
let mutated;
try {
  writeFileSync(ROUTE, original.replace(GUARD, 'if (false && !lineItem.chosenDay) {'));
  mutated = run();
} finally {
  restore();
}
const failures: string[] = [];
if (base.status !== 0) failures.push(`unmutated route: check failed: ${(base.stderr || base.stdout).slice(-300)}`);
if (mutated.status === 0) failures.push('mutated route (guard disabled): check still PASSED');
if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log('PASS: day-null check passes on the real route and fails with the guard disabled');
