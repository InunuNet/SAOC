// F4 mutation proof: each mutant of the shipped source must make legacy-and-stamp.test.mjs FAIL.
// Usage: node contracts/checks/door-reject-test-tickets/mutation.mjs
// Copies the touched sources into .tmp/sandbox/door-mutants/<name>/, mutates one rule, runs the test
// with DOOR_TEST_ROOT pointing at the copy. Exit 0 only when every mutant is killed AND the
// unmutated copy passes (so a broken harness cannot report a false kill).
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const files = ['lib/checkin.ts', 'lib/checkin-test-ticket-guard.ts', 'lib/tickets-constants.ts', 'lib/ticket-issuance-mode.ts', 'lib/checkout-reservation.ts', 'lib/orders.ts', 'lib/payments/pending-hold.ts'];
const mutants = [
  { name: 'control', file: null },
  { name: 'guard-truthy-rule', file: 'lib/checkin-test-ticket-guard.ts', from: /input\.issuedInTestMode !== false/, to: 'input.issuedInTestMode === true' },
  { name: 'guard-never-rejects', file: 'lib/checkin-test-ticket-guard.ts', from: /input\.liveMode && /, to: 'false && ' },
  { name: 'stamp-ignores-gateway', file: 'lib/ticket-issuance-mode.ts', from: /isTicketingTestMode\(\) \|\| PAYMENT_GATEWAYS_SANDBOX_ONLY/, to: 'isTicketingTestMode()' },
  { name: 'stamp-always-false', file: 'lib/ticket-issuance-mode.ts', from: /isTicketingTestMode\(\) \|\| PAYMENT_GATEWAYS_SANDBOX_ONLY/, to: 'false' },
  { name: 'orders-bypasses-helper', file: 'lib/orders.ts', from: /const issuedInTestMode = [^;]+;/, to: 'const issuedInTestMode = false;' },
];

let failed = false;
for (const mutant of mutants) {
  const dir = path.join(root, '.tmp/sandbox/door-mutants', mutant.name);
  for (const file of files) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    cpSync(path.join(root, file), path.join(dir, file));
  }
  if (mutant.file) {
    const target = path.join(dir, mutant.file);
    const before = readFileSync(target, 'utf8');
    const after = before.replace(mutant.from, mutant.to);
    if (after === before) { console.error(`mutation ${mutant.name}: pattern not found`); failed = true; continue; }
    writeFileSync(target, after);
  }
  const run = spawnSync('node', ['--test', path.join(root, 'contracts/checks/door-reject-test-tickets/legacy-and-stamp.test.mjs')], { env: { ...process.env, DOOR_TEST_ROOT: dir }, encoding: 'utf8' });
  const killed = run.status !== 0;
  const expectKilled = mutant.name !== 'control';
  console.log(`${mutant.name}: ${killed ? 'tests failed' : 'tests passed'} (${expectKilled ? 'want fail' : 'want pass'})`);
  if (killed !== expectKilled) failed = true;
}
process.exit(failed ? 1 : 0);
