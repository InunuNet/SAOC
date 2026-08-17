// A10 — F2: BEHAVIOURAL, LOCAL-ONLY kill-and-recover proof. Spawns the decoy fixture as
// a real child process, SIGKILLs it after it confirms its write completed, confirms the
// orphan really did leak into Firestore, sweeps it via sweepManifestFromPriorRun(), and
// confirms a negative control: an empty manifest issues zero Firestore delete calls. See
// contracts/golden/payfast-m1-lock-cleanup-fix/manifest-cleanup.golden.md.
//
// CREDENTIALS: LOCAL-ONLY — same credentialsAvailable()/skipForMissingCredentials()
// convention as A18 (see _itn-harness.mts).

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { credentialsAvailable, skipForMissingCredentials } from './_itn-harness.mts';

const ASSERTION_ID = 'A10';

if (!credentialsAvailable()) skipForMissingCredentials(ASSERTION_ID);

const shared = await import('../ticketing-hardening/_shared.mjs');

const DECOY_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '_fixtures/decoy-lock-holder.mjs');
const WRITE_COMPLETE_MARKER = 'DECOY: write completed';
// Kill 200ms after observing the write-complete marker. The marker itself already
// confirms both the manifest write and the Firestore write finished (createTicketDoc()
// has resolved before the decoy logs it) — the 200ms guards only against a stdout
// buffering race between the parent process reading the line and the child continuing
// to run, not against completion timing. It is short enough the decoy (which sleeps for
// 60s afterward) never reaches its own exit under normal execution.
const KILL_DELAY_AFTER_MARKER_MS = 200;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Spawns the decoy, waits for its write-complete marker, then SIGKILLs it. Resolves
 * with the decoy's stdout (for extracting the doc id it reported).
 *
 * `pnpm exec tsx` forks a NESTED child process (pnpm itself, then a separate tsx/node
 * process under it) rather than exec-replacing itself, so signalling only the direct
 * `pnpm` pid leaves the actual decoy process (and its 60s sleep) running as an orphan.
 * Spawned `detached: true` so it gets its own process group, then killed via the
 * negative-pid form of `process.kill()`, which signals the whole group — this is what
 * actually reproduces "the decoy process is gone", not just "the pnpm wrapper is gone".
 */
function spawnAndKillDecoy(runId) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', 'tsx', DECOY_PATH], {
      env: { ...process.env, DECOY_RUN_ID: runId },
      detached: true,
    });
    let stdout = '';
    let killed = false;
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (!killed && stdout.includes(WRITE_COMPLETE_MARKER)) {
        killed = true;
        setTimeout(() => {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {
            // process group already gone — fine
          }
        }, KILL_DELAY_AFTER_MARKER_MS);
      }
    });
    child.on('error', reject);
    child.on('close', () => resolve(stdout));
  });
}

// --- Step 1: baseline (do not assume a pristine environment) ---------------
const baselineSwept = await shared.sweepManifestFromPriorRun();
console.log(`${ASSERTION_ID}: baseline preflight sweep removed ${baselineSwept} pre-existing manifest entr${baselineSwept === 1 ? 'y' : 'ies'}`);

// --- Steps 2-3: spawn the decoy, kill it once its write is confirmed -------
const runId = randomBytes(4).toString('hex');
const decoyBookingRef = `DECOY-${runId}`;
console.log(`${ASSERTION_ID}: spawning decoy fixture (bookingRef ${decoyBookingRef})`);
await spawnAndKillDecoy(runId);

// --- Step 4: confirm the orphan really leaked -------------------------------
const orphanBeforeSweep = await shared.readTicketByBookingRef(decoyBookingRef);
assert(
  orphanBeforeSweep !== null,
  `${ASSERTION_ID}: expected the decoy's ticket (bookingRef ${decoyBookingRef}) to be present in Firestore after the kill — the setup did not reproduce a leak, so the recovery below would not be proving anything.`
);
console.log(`${ASSERTION_ID}: confirmed orphaned sentinel ticket IS present (tickets/${orphanBeforeSweep.id}) — the kill really did leak`);

// --- Step 5: recover via sweepManifestFromPriorRun() (fresh import call) ---
const sweptCount = await shared.sweepManifestFromPriorRun();
assert(sweptCount >= 1, `${ASSERTION_ID}: expected sweepManifestFromPriorRun() to report at least 1 swept entry, got ${sweptCount}`);

// --- Step 6: confirm the orphan is gone -------------------------------------
const orphanAfterSweep = await shared.readTicketByBookingRef(decoyBookingRef);
assert(
  orphanAfterSweep === null,
  `${ASSERTION_ID}: expected the decoy's ticket to be gone from Firestore after sweepManifestFromPriorRun(), but it is still present (tickets/${orphanAfterSweep?.id}).`
);
console.log(`${ASSERTION_ID}: confirmed sweepManifestFromPriorRun() removed the orphan`);

// --- Negative control: empty manifest issues zero Firestore delete calls ---
const database = shared.db();
let batchCallCount = 0;
const originalBatch = database.batch.bind(database);
database.batch = (...args) => {
  batchCallCount += 1;
  return originalBatch(...args);
};
const emptyManifestSweptCount = await shared.sweepManifestFromPriorRun();
database.batch = originalBatch;
assert(
  emptyManifestSweptCount === 0,
  `${ASSERTION_ID}: expected sweepManifestFromPriorRun() to report 0 swept entries against an already-clean manifest, got ${emptyManifestSweptCount}`
);
assert(
  batchCallCount === 0,
  `${ASSERTION_ID}: expected sweepManifestFromPriorRun() to issue zero Firestore batch() calls against an empty manifest, but it issued ${batchCallCount} — it must not be able to false-positive-delete on a clean manifest.`
);
console.log(`${ASSERTION_ID}: confirmed sweepManifestFromPriorRun() against an empty manifest issues zero Firestore delete calls`);

console.log(`PASS: ${ASSERTION_ID} manifest survives a kill: leak reproduced, detected, and recovered; empty-manifest negative control holds`);
