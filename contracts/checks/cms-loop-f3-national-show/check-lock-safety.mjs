#!/usr/bin/env node
// META — proves the shared nationalShow lock produces REAL mutual exclusion ACROSS the two
// contracts that both mutate it, not just two files that happen to compute the same string.
//
// WHY THIS CHECK EXISTS
// ----------------------
// contracts/checks/_shared/doc-lock-path.mjs's whole reason for existing is that A1
// (check-headline-round-trip.mjs, this contract) and show-visitor-info's
// check-show-identity-sweep.mjs both mutate the live `nationalShow` singleton, and until the
// 2026-08-22 fix they locked on two different files, so they never actually serialised — the
// confirmed root cause of two live sentinel-residue incidents (see
// .agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/goldens/m1-golden.md).
// A2/A3's grep-based checks prove both guards now CALL docLockPath('nationalShow'); they cannot
// prove the two guards' independent lock implementations actually block each other in practice.
// This check runs the REAL withDatasetLock from BOTH contracts' real guard modules — via a real
// child process, against a real file-system lock — and proves one blocks the other, in both
// directions. SAOC_DOC_LOCK_PATH_OVERRIDE redirects both guards to a throwaway sandbox path, so
// this never touches the real lock or the live dataset.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHILD = path.join(HERE, '_lock-child.mjs');

const SANDBOX_DIR = path.join(os.tmpdir(), `saoc-lock-safety-cross-contract-${process.pid}`);
const SANDBOX_LOCK = path.join(SANDBOX_DIR, 'nationalShow-dataset.lock');

const HOLD_WINDOW_S = 12;
const CONTENTION_WINDOW_S = 6; // shorter than HOLD_WINDOW_S — a contender must still be waiting
const FREE_ACQUIRE_WINDOW_S = 10; // long enough to acquire once the holder has released

let failures = 0;
function check(ok, label, detail = '') {
  if (ok) {
    console.log(`  PASS: ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function runChild(guardName, mode, seconds) {
  const child = spawn(process.execPath, [CHILD, guardName, mode, String(seconds)], {
    env: { ...process.env, SAOC_DOC_LOCK_PATH_OVERRIDE: SANDBOX_LOCK },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => {
    stdout += d;
  });
  child.stderr.on('data', (d) => {
    stderr += d;
  });
  const done = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, stdout: () => stdout, stderr: () => stderr }));
  });
  return {
    child,
    done,
    get stdout() {
      return stdout;
    },
  };
}

async function waitFor(predicate, budgetMs, intervalMs = 200) {
  const start = Date.now();
  while (Date.now() - start < budgetMs) {
    if (predicate()) return true;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
  return false;
}

// One direction of cross-contract contention: `holderGuard` acquires and holds; `contenderGuard`
// (the OTHER contract's real guard) must NOT acquire while the holder is still holding, and MUST
// acquire promptly once the holder releases.
async function proveCrossContractExclusion(holderGuard, contenderGuard) {
  console.log(`--- ${holderGuard} holds, ${contenderGuard} contends ---`);
  rmSync(SANDBOX_LOCK, { force: true });

  const holder = runChild(holderGuard, 'hold', HOLD_WINDOW_S);
  const heldOk = await waitFor(() => holder.stdout.includes('HELD'), 15_000);
  check(heldOk, `${holderGuard} acquired the sandbox lock`, holder.stdout);
  if (!heldOk) {
    if (holder.child.exitCode === null) holder.child.kill('SIGKILL');
    return;
  }

  const contender = runChild(contenderGuard, 'try', CONTENTION_WINDOW_S);
  const contenderResult = await contender.done;
  check(
    contenderResult.stdout().includes('TIMEOUT') && !contenderResult.stdout().includes('ACQUIRED'),
    `${contenderGuard}'s guard did NOT acquire the lock while ${holderGuard}'s guard held it`,
    `contender said ${JSON.stringify(contenderResult.stdout().trim())} — if this ever goes red, the two ` +
      'contracts are not actually sharing one lock file and the residue race this file exists to close is still open.',
  );

  await holder.done;
  check(!existsSync(SANDBOX_LOCK), `${holderGuard} released the sandbox lock on completion`);

  const freeAttempt = runChild(contenderGuard, 'try', FREE_ACQUIRE_WINDOW_S);
  const freeResult = await freeAttempt.done;
  check(
    freeResult.stdout().includes('ACQUIRED'),
    `${contenderGuard}'s guard acquired the lock once ${holderGuard}'s guard released it`,
    `contender said ${JSON.stringify(freeResult.stdout().trim())}`,
  );
  rmSync(SANDBOX_LOCK, { force: true });
}

// Proves the F3 token-asymmetry fix: a guard's low-level release primitive, called with a
// FOREIGN token (simulating a delayed/stale release firing after its own lock was reaped and
// the OTHER contract's guard took over the same shared path), must never delete a live lock it
// does not own — in either direction. Before this fix, cms-loop-f3's guard wrote lock files with
// no `token` field at all, and show-visitor-info's release only refused to delete on a
// MISMATCHED token, not a MISSING one — so a stale show-visitor-info release could delete a live
// cms-loop-f3 lock out from under it. See fix-live-sentinel-residue-cms-loop-f3 F3 and the
// matching comments on both guards' release functions.
// runChild's signature is (guardName, mode, seconds) — the cross probe repurposes those three
// positions as ('cross', 'foreign-release', <unused>) and reads the real holder/releaser guard
// names from argv[4:] inside the child itself, so pass them through argv here.
function runCrossProbe(holderGuard, releaserGuard) {
  const child = spawn(
    process.execPath,
    [CHILD, 'cross', 'foreign-release', holderGuard, releaserGuard],
    {
      env: { ...process.env, SAOC_DOC_LOCK_PATH_OVERRIDE: SANDBOX_LOCK },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let stdout = '';
  child.stdout.on('data', (d) => {
    stdout += d;
  });
  const done = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal, stdout: () => stdout }));
  });
  return { child, done };
}

async function proveForeignReleaseCannotDeleteLiveLock(holderGuard, releaserGuard) {
  console.log(`--- ${holderGuard} holds a live lock, ${releaserGuard}'s guard attempts a foreign-token release ---`);
  rmSync(SANDBOX_LOCK, { force: true });
  const { done } = runCrossProbe(holderGuard, releaserGuard);
  const result = await done;
  check(
    result.stdout().includes('PROTECTED'),
    `${releaserGuard}'s guard did NOT delete ${holderGuard}'s live lock via a foreign-token release`,
    `probe said ${JSON.stringify(result.stdout().trim())} — DELETED-BUG means the token asymmetry regressed.`,
  );
  rmSync(SANDBOX_LOCK, { force: true });
}

mkdirSync(SANDBOX_DIR, { recursive: true });
try {
  await proveCrossContractExclusion('show-visitor-info', 'cms-loop-f3');
  await proveCrossContractExclusion('cms-loop-f3', 'show-visitor-info');
  await proveForeignReleaseCannotDeleteLiveLock('cms-loop-f3', 'show-visitor-info');
  await proveForeignReleaseCannotDeleteLiveLock('show-visitor-info', 'cms-loop-f3');
} finally {
  rmSync(SANDBOX_DIR, { recursive: true, force: true });
}

if (failures === 0) {
  console.log('PASS: the shared nationalShow lock produces real mutual exclusion across both contracts, in both directions.');
  process.exit(0);
} else {
  console.error(`FAIL: ${failures} check(s) failed — see above.`);
  process.exit(1);
}
