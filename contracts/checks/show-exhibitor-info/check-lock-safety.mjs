#!/usr/bin/env node
// META — proves the dataset mutation guard behaves under the conditions that actually broke it.
//
// WHY THIS CHECK EXISTS
// ---------------------
// Every other assertion in this contract trusts _mutation-guard.mjs to serialise the two mutating
// checks and to hand the dataset back the way it found it. On 2026-08-11 that trust was misplaced
// in a specific, boring way: contract.py SIGKILLed a check at its 60s timeout, the `finally` never
// ran, and the lock file outlived the process that wrote it. It happened twice in one night. The
// next run then found a lock held by pid 68322 — a pid with no process behind it — and, because
// the guard only ever compared the lock's AGE against a thirty-minute staleness window, refused to
// proceed for reasons that had stopped being true within milliseconds of the kill.
//
// A guard nobody tests is a guard nobody can rely on, and the failure mode here is not a red gate:
// it is a machine token published as the entry deadline on a page exhibitors plan around. So the
// guard gets a test, and it runs in the gate beside the checks that depend on it.
//
// This check touches NO dataset and NO network. It runs the real guard code against a throwaway
// lock path via EXH_LOCK_PATH, so a failure here means the guard is broken, never that Sanity or
// the dev server is having a bad minute.
//
// Five behaviours, each one a thing that was wrong or a thing that must not silently become wrong:
//   T1  a lock whose pid is dead is reaped promptly, not waited out            (the F-2 bug)
//   T2  a lock whose pid is ALIVE is respected                                 (the F-2 overfix)
//   T3  release is ownership-checked                                           (the F-2 overfix)
//   T4  SIGTERM releases the lock on the way out                               (the F-2 bug)
//   T5  a poisoned baseline is still rejected                                  (regression guard)
//
// T2 and T3 matter as much as T1. The obvious fix for "locks leak" is to reap more eagerly, and an
// over-eager reaper is strictly worse than a leaked lock: a leaked lock stops work loudly, while a
// stolen lock lets two writers into the same document quietly, which is the original sin this
// whole file was written to prevent.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCheck } from './_shared.mjs';
import { assertNotPoisoned, isPidAlive, PoisonedBaselineError } from './_mutation-guard.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHILD = path.join(HERE, '_lock-child.mjs');

const SANDBOX_DIR = path.join(os.tmpdir(), `saoc-lock-safety-${process.pid}`);
const SANDBOX_LOCK = path.join(SANDBOX_DIR, 'test.lock');

// T1 must complete far inside this. The old code would have taken LOCK_STALE_MS (1800s).
const REAP_BUDGET_MS = 20_000;
// T2 gives the contender long enough to make at least two poll passes (LOCK_POLL_MS is 3s).
const CONTENTION_WINDOW_S = 8;
const HOLD_WINDOW_S = 30;
const SIGTERM_RELEASE_BUDGET_MS = 8_000;

function writeLockFile(body) {
  mkdirSync(SANDBOX_DIR, { recursive: true });
  writeFileSync(SANDBOX_LOCK, JSON.stringify(body));
}

function readLockFile() {
  try {
    return JSON.parse(readFileSync(SANDBOX_LOCK, 'utf8'));
  } catch {
    return null;
  }
}

// A pid that is guaranteed dead: spawn something trivial and wait for it to exit. Inventing a
// large pid and hoping it is free is the kind of flake that gets a check deleted.
function spawnAndReap() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', '0'], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', () => setTimeout(() => resolve(child.pid), 250));
  });
}

function runChild(mode, seconds) {
  const child = spawn(process.execPath, [CHILD, mode, String(seconds)], {
    env: { ...process.env, EXH_LOCK_PATH: SANDBOX_LOCK },
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
    child.on('exit', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
  return {
    child,
    done,
    get stdout() {
      return stdout;
    },
    get stderr() {
      return stderr;
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

// The guard reads EXH_LOCK_PATH once, at module load. T1 and T3 run the guard in THIS process, so
// the env var has to be set before the dynamic import below, and the module has to be imported
// fresh rather than reusing whatever the static import above already resolved.
process.env.EXH_LOCK_PATH = SANDBOX_LOCK;
const { withDatasetLock } = await import(`./_mutation-guard.mjs?sandbox=${process.pid}`);

await runCheck('check-lock-safety', async (r) => {
  mkdirSync(SANDBOX_DIR, { recursive: true });
  const holders = [];

  try {
    // --- T0: the liveness primitive itself -------------------------------------------------
    const deadPid = await spawnAndReap();
    r.check(isPidAlive(process.pid), 'isPidAlive reports this process as alive');
    r.check(!isPidAlive(deadPid), `isPidAlive reports an exited process (pid ${deadPid}) as dead`);
    r.check(!isPidAlive(0) && !isPidAlive(-1) && !isPidAlive(undefined), 'isPidAlive rejects non-pids');

    // --- T1: a dead holder's lock is reaped, not waited out ---------------------------------
    // Run in a CHILD with a bounded window rather than inline. Without the reaper this scenario
    // does not fail, it hangs for the full 1800s stale window — and a check that fails by hanging
    // is a check that reports "timed out" instead of "the reaper is broken". Bounding it here
    // means the broken case comes back as a red assertion in twenty seconds with the right words
    // on it.
    writeLockFile({ owner: 'ghost-run', pid: deadPid, at: Date.now() });
    const t1Start = Date.now();
    const reaper = runChild('try', REAP_BUDGET_MS / 1000);
    const t1 = await reaper.done;
    const t1Elapsed = Date.now() - t1Start;
    r.check(
      t1.stdout.includes('ACQUIRED'),
      `T1 the guard acquired a lock abandoned by a dead process (${t1Elapsed}ms)`,
      `child said ${JSON.stringify(t1.stdout.trim())}. A lock is a claim by a live process; once ` +
        'that process is gone the claim is void. Waiting out the 1800s stale window instead is ' +
        'how one killed run wedged every later run of the night.',
    );
    r.check(!existsSync(SANDBOX_LOCK), 'T1 the lock was released afterwards');

    // --- T2: a LIVE holder's lock is respected ----------------------------------------------
    // The over-correction guard. If this ever goes red, the reaper is stealing locks and the
    // whole mechanism has become decorative.
    rmSync(SANDBOX_LOCK, { force: true });
    const holder = runChild('hold', HOLD_WINDOW_S);
    holders.push(holder);
    const heldOk = await waitFor(() => holder.stdout.includes('HELD'), 15_000);
    r.check(heldOk, 'T2 a holder process acquired the lock', holder.stderr.slice(0, 400));

    const holderPid = readLockFile()?.pid;
    r.check(isPidAlive(holderPid), `T2 the recorded holder pid ${holderPid} is alive`);

    const contender = runChild('try', CONTENTION_WINDOW_S);
    const contenderResult = await contender.done;
    r.check(
      contenderResult.stdout.includes('TIMEOUT') && !contenderResult.stdout.includes('ACQUIRED'),
      'T2 a second run did NOT take the lock while a live process held it',
      `contender said ${JSON.stringify(contenderResult.stdout.trim())}. An over-eager reaper is ` +
        'worse than a leaked lock: it puts two writers into one document silently.',
    );
    r.check(
      readLockFile()?.pid === holderPid,
      'T2 the holder still owns the lock file after the contention window',
    );

    // --- T4: SIGTERM releases -----------------------------------------------------------------
    holder.child.kill('SIGTERM');
    const releasedOnSignal = await waitFor(() => !existsSync(SANDBOX_LOCK), SIGTERM_RELEASE_BUDGET_MS);
    r.check(
      releasedOnSignal,
      'T4 SIGTERM released the lock instead of leaking it',
      'the signal handler did not remove the lock file. SIGKILL cannot be caught, but SIGTERM ' +
        'can, and every leak that is catchable should be caught.',
    );
    await holder.done;

    // --- T3: release is ownership-checked -----------------------------------------------------
    // Simulate the nastiest ordering: our lock is reaped mid-run and someone else acquires. The
    // guard must leave THEIR lock alone on the way out.
    rmSync(SANDBOX_LOCK, { force: true });
    await withDatasetLock('lock-safety-t3', async () => {
      writeLockFile({ owner: 'someone-else', pid: process.pid + 1, at: Date.now() });
    });
    const survivor = readLockFile();
    r.check(
      survivor?.owner === 'someone-else',
      "T3 the guard did not delete a lock that was no longer its own",
      `lock is now ${JSON.stringify(survivor)}. An unconditional release turns one leaked lock ` +
        'into two concurrent writers.',
    );
    rmSync(SANDBOX_LOCK, { force: true });

    // --- T5: poisoned baselines still rejected ------------------------------------------------
    let threwOnNested = false;
    try {
      assertNotPoisoned('keyDates', [{ label: 'Entries close', dateNote: 'EXH-DEADLINE-SENTINEL-1' }]);
    } catch (err) {
      threwOnNested = err instanceof PoisonedBaselineError;
    }
    r.check(threwOnNested, 'T5 a sentinel nested inside an array baseline is still rejected');

    let threwOnClean = false;
    try {
      assertNotPoisoned('keyDates', [{ label: 'Entries close', dateNote: 'To be set by the show committee' }]);
    } catch {
      threwOnClean = true;
    }
    r.check(!threwOnClean, 'T5 a clean baseline is still accepted');
  } finally {
    for (const h of holders) {
      if (h.child.exitCode === null) h.child.kill('SIGKILL');
    }
    rmSync(SANDBOX_DIR, { recursive: true, force: true });
  }
});
