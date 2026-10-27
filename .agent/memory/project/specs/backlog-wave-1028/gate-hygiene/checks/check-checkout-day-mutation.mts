// gate-hygiene item 3 (mutation proof): the checkout day-null check must FAIL when the route's day-selection guard is disabled.
// Rewrites app/api/tickets/checkout/route.ts in place, runs the check, restores byte-for-byte in a finally and on exit/signals.
// Run as: pnpm exec tsx <this file> (from the checkout under test)
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const ROUTE = 'app/api/tickets/checkout/route.ts';
const CHECK = '.agent/memory/project/specs/backlog-wave-1028/gate-hygiene/checks/check-checkout-day-null.mts';
const original = readFileSync(ROUTE, 'utf8');
const mutants = [
  { id: 'M1 day guard disabled', from: 'if (!lineItem.chosenDay) {', to: 'if (false && !lineItem.chosenDay) {' },
  { id: 'M2 requiresDaySelection derived from a fixed slug list, not the CMS flag', from: 'requiresDaySelectionByType[slug] = ticketTypeDoc.requiresDaySelection === true;', to: "requiresDaySelectionByType[slug] = slug === 'weekend-pass' || slug === 'workshop-pass';" },
  { id: 'M3 every type treated as day-required', from: 'requiresDaySelectionByType[slug] = ticketTypeDoc.requiresDaySelection === true;', to: 'requiresDaySelectionByType[slug] = true;' },
  { id: 'M4 day guard checks only the first line item', from: 'for (const lineItem of lineItems) {\n    if (requiresDaySelectionByType[lineItem.ticketType]) {', to: 'for (const lineItem of lineItems.slice(0, 1)) {\n    if (requiresDaySelectionByType[lineItem.ticketType]) {' },
];
for (const m of mutants) if (!original.includes(m.from)) { console.error(`FAIL\n${m.id}: anchor not found in ${ROUTE}`); process.exit(1); }
const restore = () => writeFileSync(ROUTE, original);
process.on('exit', restore);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => { restore(); process.exit(130); });

const run = () => spawnSync('pnpm', ['exec', 'tsx', CHECK], { encoding: 'utf8' });
const failures: string[] = [];
const base = run();
if (base.status !== 0) failures.push(`unmutated route: check failed: ${(base.stderr || base.stdout).slice(-300)}`);
for (const m of mutants) {
  try {
    writeFileSync(ROUTE, original.replace(m.from, m.to));
    if (run().status === 0) failures.push(`${m.id}: check still PASSED`);
  } finally {
    restore();
  }
}
if (failures.length) { console.error('FAIL\n' + failures.join('\n')); process.exit(1); }
console.log(`PASS: day-null check passes on the real route and fails on all ${mutants.length} mutants`);
