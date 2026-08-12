// show-exhibitor-info — dataset mutation safety for every check that writes.
//
// WHY THIS FILE EXISTS
// --------------------
// Two separate incidents, one class of defect.
//
//   1. In the sibling show-visitor-info contract on 2026-08-11, two runs of its round-trip check
//      interleaved. Run B captured run A's sentinel as its "baseline" — the only validation was
//      that the value was a non-empty string, which a sentinel satisfies happily — restored that
//      garbage, and reported a clean cleanup. `showVisitorInfo.parking` was left rendering
//      SVI-PARKING-SENTINEL-… on the live page.
//   2. This contract had the same hole and it fired the same night: an abandoned run of
//      check-cms-round-trip left EXH-DEADLINE-SENTINEL-1786482650802 in
//      showExhibitorInfo.keyDates[0].dateNote, rendering on /national-show/exhibitors, with no
//      process alive to restore it. The next run would have captured it as its baseline.
//
// Three independent defences, because any one of them can be bypassed:
//
//   1. POISONED-BASELINE REJECTION. A baseline that looks like any check's sentinel is a hard
//      failure, never a value we restore. The cheapest defence, and the only one that still works
//      when the colliding writer is a crashed process or a human in Studio.
//   2. AN EXCLUSIVE LOCK. Atomic `wx` create in the OS temp dir, held for the whole
//      mutate/verify/restore window, released in a `finally`. Serialises this contract's mutating
//      checks against each other, including two copies of the same check.
//   3. REVISION-GUARDED WRITES. Each restore patches with `ifRevisionID` set to the revision our
//      own write produced. If anything wrote in between, the restore fails loudly instead of
//      silently clobbering the other writer.
//
// Defence 1 catches damage after the fact, 2 prevents it between our own checks, 3 prevents it
// against writers that never take our lock. All three are needed.
//
// SIGNAL DEATH — added 2026-08-12 after QA finding F-2.
// -----------------------------------------------------
// Defence 2 originally assumed the `finally` always runs. It does not. contract.py enforces its
// per-assertion timeout with subprocess.run(timeout=), which SIGKILLs on POSIX — no handler, no
// `finally`, no unwind. Two runs died that way in one night and each left its lock file behind
// holding a pid that no longer existed, so the NEXT run sat in the wait loop for the full 30
// minutes of LOCK_STALE_MS before it would even consider taking over. A lock is a claim by a live
// process; once that process is gone the claim is void, and age is a poor proxy for liveness.
//
// So: a lock whose recorded pid is not alive is reapable immediately, and SIGTERM/SIGINT release
// it on the way out. SIGKILL still cannot be caught — that is exactly why the reaper exists, and
// why the real fix for the killing itself is an adequate `timeout_seconds` on the assertion.
//
// Release is now OWNERSHIP-CHECKED. The old `finally` did an unconditional rmSync, which meant a
// process whose own lock had already been reaped would delete the lock of whoever legitimately
// took over next — turning one leaked lock into a silent interleave, the precise failure this
// file exists to prevent.

import {
  mkdirSync,
  openSync,
  closeSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EXIT_CODE_RESIDUE_ALERT = 2;

// Every sentinel this contract writes must match this pattern, so one test recognises residue from
// ANY check here — including checks not yet written. The sibling's SVI- namespace is recognised
// too: the two contracts write to different documents, but a baseline holding either one means a
// check run left residue somewhere, and neither is a value worth restoring.
export const SENTINEL_PATTERN = /(?:EXH|SVI)-[A-Z0-9-]*SENTINEL-\d+|not-a-real-status-\d+/i;

export function makeSentinel(tag) {
  const clean = String(tag).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) throw new Error('makeSentinel requires a non-empty tag');
  return `EXH-${clean}-SENTINEL-${Date.now()}`;
}

// Deep test: a baseline is an array of rows or a nested object, so a top-level string test would
// miss a sentinel sitting in keyDates[0].dateNote — which is exactly where this contract's
// residue landed.
export function findSentinel(value) {
  if (typeof value === 'string') return SENTINEL_PATTERN.test(value) ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findSentinel(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const hit = findSentinel(item);
      if (hit) return hit;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Defence 1 — poisoned baseline
// ---------------------------------------------------------------------------

export class PoisonedBaselineError extends Error {}

// A sentinel-shaped baseline is a LIVE INCIDENT, not a bad input: it means an earlier run left
// residue that has been rendering on the published page. Refuse to start — restoring this value
// would make the residue permanent and report it as clean.
export function assertNotPoisoned(field, value) {
  const hit = findSentinel(value);
  if (hit) {
    throw new PoisonedBaselineError(
      `POISONED BASELINE — ${field} currently contains ${JSON.stringify(hit)}.\n` +
        'That is a sentinel left behind by an earlier check run, which means it has been ' +
        'RENDERING ON THE LIVE SITE. This check refuses to start, because capturing this value ' +
        'as a baseline and restoring it would make the residue permanent.\n' +
        'Restore the field from its seed value in scripts/seed-show-exhibitor-info.ts, verify the ' +
        'rendered page, then re-run.',
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Defence 2 — exclusive lock
// ---------------------------------------------------------------------------

// EXH_LOCK_PATH exists so the lock self-test (check-lock-safety.mjs) can exercise the real code
// on a throwaway path instead of the live one. Nothing else sets it: a mutating check that
// pointed itself at a private lock would serialise against nobody.
export const LOCK_PATH =
  process.env.EXH_LOCK_PATH ??
  path.join(os.tmpdir(), 'saoc-contract-locks', 'show-exhibitor-info-dataset.lock');
const LOCK_DIR = path.dirname(LOCK_PATH);
const LOCK_WAIT_TIMEOUT_MS = 900_000;
const LOCK_POLL_MS = 3_000;
const LOCK_STALE_MS = 1_800_000;

function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// Age of the lock FILE, used when its contents are missing or unparseable. A lock that cannot be
// read is not automatically reapable: `tryAcquire` creates the file and writes its body in two
// steps, so there is a microsecond window in which a well-formed live lock reads as empty.
// Falling back to mtime means that window resolves as "brand new", not "abandoned".
function lockFileAgeMs() {
  try {
    return Date.now() - statSync(LOCK_PATH).mtimeMs;
  } catch {
    return Infinity;
  }
}

// signal 0 performs the permission and existence checks without delivering anything. EPERM means
// the process exists and belongs to another user — alive, and not ours to reap.
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

function tryAcquire(owner) {
  mkdirSync(LOCK_DIR, { recursive: true });
  let fd;
  try {
    // 'wx' fails if the path exists — the atomicity this whole mechanism rests on.
    fd = openSync(LOCK_PATH, 'wx');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return false;
  }
  // Write through the fd we already hold, so create-and-populate is one step from the OS's point
  // of view rather than two calls with an empty file visible in between.
  try {
    writeFileSync(fd, JSON.stringify({ owner, pid: process.pid, at: Date.now() }));
  } finally {
    closeSync(fd);
  }
  return true;
}

// True only if the lock on disk is still the one WE wrote. Both fields are compared: pids are
// recycled by the OS, and owner alone would let two runs of the same check clear each other.
function weStillHold(owner) {
  const current = readLock();
  return current?.pid === process.pid && current?.owner === owner;
}

function releaseIfOurs(owner, { quiet = false } = {}) {
  if (!weStillHold(owner)) {
    if (!quiet) {
      console.warn(
        `  [lock] NOT released by ${owner} — the lock on disk is no longer ours. It was reaped ` +
          'while we held it and another run may now own it. Clearing it here would hand two ' +
          'writers the dataset at once.',
      );
    }
    return false;
  }
  rmSync(LOCK_PATH, { force: true });
  if (!quiet) console.log(`  [lock] released by ${owner}`);
  return true;
}

// Runs `fn` with exclusive access to this contract's mutable dataset fields. Every mutating check
// in this contract MUST go through here; a check that writes outside the lock reopens the
// interleaving hole for all the others.
export async function withDatasetLock(owner, fn) {
  const start = Date.now();
  let held = false;

  while (!held) {
    if (tryAcquire(owner)) break;
    const existing = readLock();
    const age = existing?.at ? Date.now() - existing.at : lockFileAgeMs();

    // Liveness before age. A dead pid's claim is void the instant the process is gone, and
    // waiting out LOCK_STALE_MS for a lock nobody holds is thirty minutes of nothing.
    if (existing && 'pid' in existing && !isPidAlive(existing.pid)) {
      console.warn(
        `  [lock] REAPING a lock held by a DEAD process: ${existing.owner ?? 'unknown'} ` +
          `(pid ${existing.pid}, ${Math.round(age / 1000)}s old). That run was killed before it ` +
          'could release. If it was killed mid-write, the dataset may still hold a sentinel — ' +
          'the poisoned-baseline check below is what catches that.',
      );
      rmSync(LOCK_PATH, { force: true });
      continue;
    }

    if (age > LOCK_STALE_MS) {
      console.warn(
        `  [lock] taking over a stale lock held by ${existing?.owner ?? 'unknown'} ` +
          `(pid ${existing?.pid ?? '?'}, ${Math.round(age / 1000)}s old)`,
      );
      rmSync(LOCK_PATH, { force: true });
      continue;
    }
    if (Date.now() - start > LOCK_WAIT_TIMEOUT_MS) {
      // A hard failure, never a skip: another mutating check is still running, and this one cannot
      // produce a trustworthy result while that is true.
      throw new Error(
        `FAIL: could not acquire the dataset lock within ${LOCK_WAIT_TIMEOUT_MS / 1000}s. ` +
          `Held by ${existing?.owner ?? 'unknown'} (pid ${existing?.pid ?? '?'}). ` +
          `If that process is gone, delete ${LOCK_PATH}.`,
      );
    }
    console.log(`  [lock] waiting for ${existing?.owner ?? 'another check'}…`);
    await new Promise((res) => setTimeout(res, LOCK_POLL_MS));
  }

  console.log(`  [lock] acquired by ${owner}`);

  // SIGKILL cannot be caught, but SIGTERM and SIGINT can, and both reach these checks in normal
  // use — Ctrl-C, a supervising runner shutting down, an IDE stopping the task. Releasing here
  // turns "leaked until someone notices" into "released on the way out".
  const onSignal = (signal) => {
    console.error(`\n  [lock] ${signal} received — releasing the dataset lock before exiting.`);
    releaseIfOurs(owner, { quiet: true });
    // Re-raise with the default handler so the exit status reports the signal honestly rather
    // than a fabricated clean exit.
    process.removeListener(signal, onSignal);
    process.kill(process.pid, signal);
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);

  try {
    return await fn();
  } finally {
    process.removeListener('SIGTERM', onSignal);
    process.removeListener('SIGINT', onSignal);
    releaseIfOurs(owner);
  }
}

// ---------------------------------------------------------------------------
// Defence 3 — revision-guarded write and restore
// ---------------------------------------------------------------------------

// Applies a patch and returns the resulting revision, so the caller can require that exact
// revision to still be current when it restores.
export async function commitAndCaptureRev(client, docId, values, expectedRev) {
  const patch = expectedRev
    ? client.patch(docId, { ifRevisionID: expectedRev })
    : client.patch(docId);
  const result = await patch.set(values).commit();
  return result._rev;
}

export function isRevisionConflict(err) {
  return err?.statusCode === 409 || /revision/i.test(err?.message ?? '');
}
