// show-visitor-info — dataset mutation safety, shared by every check that writes.
//
// WHY THIS FILE EXISTS
// --------------------
// On 2026-08-11 two runs of check-cms-round-trip interleaved. Run B captured run A's sentinel
// as its "baseline" — the only validation was `typeof baseline === 'string' && baseline !== ''`,
// which a sentinel satisfies happily — then dutifully restored that garbage and reported a
// clean cleanup. `showVisitorInfo.parking` was left holding SVI-PARKING-SENTINEL-1786481132420
// and rendered it on the live /national-show/plan-your-visit page. See
// .agent/memory/scratch/visitor-qa.md S3.
//
// Three independent defences, because any one of them can be bypassed:
//
//   1. POISONED-BASELINE REJECTION. A baseline that looks like any check's sentinel is a hard
//      failure (exit 2), never a value we restore. This is the cheapest defence and the only
//      one that works when the colliding writer is a human in Studio.
//   2. AN EXCLUSIVE LOCK. Atomic `wx` create in the OS temp dir, held for the whole
//      mutate/verify/restore window, released in a `finally`. Serialises every mutating check
//      in this contract against every other one, including two copies of the same check.
//   3. REVISION-GUARDED RESTORE. The restore patches with `ifRevisionID` set to the revision
//      OUR sentinel write produced. If anything wrote to the document in between, the restore
//      fails loudly instead of silently clobbering a concurrent writer's value.
//
// Defence 1 catches the damage after the fact, 2 prevents it between our own checks, 3
// prevents it against writers that never take our lock. All three are needed.

import { mkdirSync, openSync, closeSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EXIT_CODE_RESIDUE_ALERT = 2;
// A check that could not run because another check legitimately held the dataset lock has NOT
// failed — it never got to test anything. Reporting that as an ordinary FAIL is how the team lead
// lost time on 2026-08-12 diagnosing a non-problem: `contract.py` records pass/fail only, so the
// exit code plus a banner is the channel available, exactly as exit 2 already signals residue.
//   0 = passed   1 = a real failure   2 = RESIDUE (live content incident)   3 = BLOCKED (never ran)
export const EXIT_CODE_BLOCKED = 3;

export class DatasetLockBlockedError extends Error {}

// Every sentinel this contract writes must start with SVI- and contain -SENTINEL-, so that a
// single pattern recognises residue from ANY of these checks — including checks not yet
// written. A check that invents its own sentinel shape defeats defence 1 for every other check.
export const SENTINEL_PREFIX = 'SVI-';
export const SENTINEL_PATTERN = /SVI-[A-Z0-9-]*-SENTINEL-\d+/;

export function makeSentinel(tag) {
  const clean = String(tag).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) throw new Error('makeSentinel requires a non-empty tag');
  return `${SENTINEL_PREFIX}${clean}-SENTINEL-${Date.now()}`;
}

export function looksLikeSentinel(value) {
  return typeof value === 'string' && SENTINEL_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Defence 1 — poisoned baseline
// ---------------------------------------------------------------------------

export class PoisonedBaselineError extends Error {}

// A baseline is only usable if it is real editorial content. Empty, missing, or
// sentinel-shaped are all refusals — and a sentinel-shaped baseline is a LIVE INCIDENT,
// because it means a previous run left residue in the published dataset.
export function assertUsableBaseline(field, value) {
  if (looksLikeSentinel(value)) {
    throw new PoisonedBaselineError(
      `POISONED BASELINE — ${field} currently holds ${JSON.stringify(value)}.\n` +
        'That is a sentinel left behind by an earlier check run, which means it has been ' +
        'RENDERING ON THE LIVE SITE. This check refuses to start, because restoring this ' +
        'value would make the residue permanent.\n' +
        'Restore the field from its seed value in scripts/seed-show-visitor-info.ts, verify ' +
        'the rendered page, then re-run.',
    );
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new PoisonedBaselineError(
      `UNUSABLE BASELINE — ${field} holds ${JSON.stringify(value)}. This check restores to the ` +
        'captured baseline and needs real content to capture. Seed the field first.',
    );
  }
  return value;
}

// ---------------------------------------------------------------------------
// Defence 2 — exclusive lock
// ---------------------------------------------------------------------------

const LOCK_DIR = path.join(os.tmpdir(), 'saoc-contract-locks');
// SCOPE, KNOWN AND DELIBERATE: this lock serialises THIS contract's checks against each other,
// which is the collision that actually happened. It does NOT serialise against other contracts —
// the exhibitor stream keeps its own lock beside this one in the same directory, and both
// streams can write nationalShow. Cross-contract safety rests on defence 3, the revision guard,
// which makes such a collision fail loudly instead of silently. Promoting these to one shared
// `saoc-sanity-dataset.lock` needs both streams to adopt it in the same change; raised with the
// team lead rather than done unilaterally, since a half-adopted rename is worse than neither.
const LOCK_PATH = path.join(LOCK_DIR, 'show-visitor-info-dataset.lock');
// THE INVARIANT: every mutating assertion's `timeout_seconds` >= LOCK_WAIT_TIMEOUT_MS + that
// check's measured worst-case runtime. If the wait can outlast the ceiling, `contract.py`
// SIGKILLs the check while it is still queuing — a false RED indistinguishable from a real one.
// Change this constant and you must re-check every ceiling in the contract.
//
// 420s, raised from 240s after 240s proved too tight: with two gate runs in flight at once
// (2026-08-12), check-cms-round-trip queued behind two other mutators and hard-failed without
// ever having mutated anything. Harmless to the dataset, but it costs a full re-run to discover
// that the red was scheduling rather than a defect. 420s absorbs two mutators ahead of us.
// A wait longer than that means the holder is wedged, not merely slow, and a hard FAIL naming
// the holder is then the useful outcome — never a skip. Within a SINGLE gate run this never
// fires at all: contract.py runs assertions one at a time.
const LOCK_WAIT_TIMEOUT_MS = 420_000;
const LOCK_POLL_MS = 3_000;
const LOCK_STALE_MS = 1_200_000;

// A lock whose owning process is gone can never be released by that process, and waiting the
// full LOCK_STALE_MS for it wastes 20 minutes of a gate run. Two dead-pid locks were left
// behind on 2026-08-11 when agents were killed mid-check. Liveness is checked with signal 0,
// which tests for the process without touching it. PID REUSE is the one hazard: a recycled pid
// reads as alive, which only makes takeover more conservative, never less.
function ownerIsAlive(pid) {
  if (typeof pid !== 'number') return true; // unknown owner — treat as live, fall back to age
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // alive but not ours to signal
  }
}

function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

// A token unique to one acquisition, so a release can only ever remove OUR lock. Without it,
// a process whose lock was legitimately reaped (say it was paused past the stale window) would
// delete the successor's lock on its way out and hand the dataset to two writers at once.
function makeToken() {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function tryAcquire(owner, token) {
  mkdirSync(LOCK_DIR, { recursive: true });
  try {
    // 'wx' fails if the path exists — the atomicity this whole mechanism rests on.
    const fd = openSync(LOCK_PATH, 'wx');
    closeSync(fd);
    writeFileSync(LOCK_PATH, JSON.stringify({ owner, pid: process.pid, token, at: Date.now() }));
    return true;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return false;
  }
}

// Releases only if the lock on disk is still the one we took. Safe to call more than once,
// which matters because it runs from both the `finally` and the signal handlers.
function releaseLock(token) {
  const current = readLock();
  if (current && current.token && current.token !== token) return false;
  rmSync(LOCK_PATH, { force: true });
  return true;
}

// Runs `fn` with exclusive access to this contract's mutable dataset fields. Every mutating
// check in this contract MUST go through here; a check that writes outside the lock reopens
// the interleaving hole for all the others.
// READERS TAKE THIS LOCK TOO. A read-only check cannot be made reliable by polling alone while a
// mutating check is in flight: check-show-identity-sweep deliberately UNSETS countdownDate for
// minutes at a time, so a reader that observes the dataset mid-sweep sees a state that is
// genuinely invalid, and no amount of settling converges on it. That is the whole of the
// "rotating single red" @dev chased across three gate runs. Readers pass a shorter
// `waitTimeoutMs` because they are cheap to retry; mutators use the default.
export async function withDatasetLock(owner, fn, { waitTimeoutMs = LOCK_WAIT_TIMEOUT_MS } = {}) {
  const start = Date.now();
  const token = makeToken();
  let held = false;
  let waits = 0;

  while (!held) {
    if (tryAcquire(owner, token)) {
      held = true;
      break;
    }
    const existing = readLock();
    const age = existing?.at ? Date.now() - existing.at : Infinity;
    if (existing === null) {
      // The file exists but holds no readable owner. That is either abandoned junk or the
      // microsecond between another process's `wx` create and its writeFileSync — deleting it
      // in that window would let two processes hold the lock at once, so give the writer a
      // grace period before the age rule below reclaims it.
      console.log('  [lock] lock file present but unreadable; waiting for its owner to identify itself…');
      await new Promise((res) => setTimeout(res, LOCK_POLL_MS));
      if (readLock() === null) rmSync(LOCK_PATH, { force: true });
      continue;
    }
    const dead = !ownerIsAlive(existing.pid);
    if (dead) {
      console.warn(
        `  [lock] taking over an ABANDONED lock — owner ${existing?.owner ?? 'unknown'} ` +
          `(pid ${existing?.pid ?? '?'}) is no longer running`,
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
    if (Date.now() - start > waitTimeoutMs) {
      // A hard failure, never a skip: another mutating check is still running, and this one
      // cannot produce a trustworthy result while that is true.
      throw new DatasetLockBlockedError(
        `could not acquire the dataset lock within ${waitTimeoutMs / 1000}s. ` +
          `Held by ${existing?.owner ?? 'unknown'} (pid ${existing?.pid ?? '?'}). ` +
          `If that process is gone, delete ${LOCK_PATH}.`,
      );
    }
    // Logged sparsely on purpose: contract.py keeps only the first 500 characters of output as
    // evidence, and 140 lines of "waiting…" would push the BLOCKED banner out of it.
    if (waits % 10 === 0) {
      console.log(
        `  [lock] waiting for ${existing?.owner ?? 'another check'} ` +
          `(${Math.round((Date.now() - start) / 1000)}s so far)…`,
      );
    }
    waits += 1;
    await new Promise((res) => setTimeout(res, LOCK_POLL_MS));
  }

  console.log(`  [lock] acquired by ${owner}`);

  // A `finally` only runs if the process lives long enough to reach it. `contract.py` kills a
  // check that overruns its timeout (subprocess.run(timeout=…) → Popen.kill()), and an
  // interrupted agent kills it too — which is how this contract's lock was left behind on
  // 2026-08-11 for a pid that no longer existed, blocking every later run. Two halves:
  //   - SIGTERM/SIGINT/SIGHUP are catchable, so release the lock and re-raise the signal so the
  //     exit status still says "killed by signal" rather than laundering it into a clean exit.
  //   - SIGKILL is NOT catchable by anything, ever. That case is covered on the acquire side by
  //     ownerIsAlive() reaping a lock whose recorded pid is gone.
  // Note this releases the LOCK only. A killed check cannot restore the dataset it mutated;
  // that is what the assertion's timeout_seconds headroom exists to prevent.
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP'];
  const onSignal = (signal) => {
    releaseLock(token);
    console.error(`  [lock] released by ${owner} on ${signal} (check was killed mid-run)`);
    process.removeListener(signal, onSignal);
    process.kill(process.pid, signal);
  };
  for (const signal of signals) process.on(signal, onSignal);

  try {
    return await fn();
  } finally {
    for (const signal of signals) process.removeListener(signal, onSignal);
    const releasedByUs = releaseLock(token);
    console.log(
      releasedByUs
        ? `  [lock] released by ${owner}`
        : `  [lock] NOT released by ${owner} — the lock on disk belongs to another run, which ` +
          'means ours was reaped while we held it. Treat any dataset result from this run as suspect.',
    );
  }
}

// ---------------------------------------------------------------------------
// Defence 3 — revision-guarded write and restore
// ---------------------------------------------------------------------------

// Applies `patchFn` and returns the resulting revision, so the caller can require that exact
// revision to still be current when it restores.
export async function commitAndCaptureRev(client, docId, mutation) {
  const result = await client.patch(docId).set(mutation).commit();
  return result._rev;
}

// Restores `values`, but only if the document is still at `expectedRev` — i.e. only if nothing
// else has written since our own sentinel landed. A concurrent write makes this throw, which
// is the point: the previous version silently overwrote whatever the other run had done.
export async function restoreGuarded(client, docId, values, expectedRev) {
  await client.patch(docId, { ifRevisionID: expectedRev }).set(values).commit();
}

// Verifies a restore actually took, in the dataset. Rendered-page verification is the caller's
// job because only the caller knows which surface renders the field.
export async function verifyDatasetRestored(client, docId, values) {
  const keys = Object.keys(values);
  const projection = keys.map((k) => `"${k}": ${k}`).join(', ');
  const after = await client.fetch(`*[_id == $id][0]{ ${projection} }`, { id: docId });
  const mismatched = keys.filter((k) => JSON.stringify(after?.[k]) !== JSON.stringify(values[k]));
  return { ok: mismatched.length === 0, mismatched, after };
}

export function residueAlert(lines) {
  console.error('\n' + '='.repeat(78));
  console.error('RESIDUE ALERT — the dataset may be holding check data that is RENDERING LIVE');
  for (const line of lines) console.error(line);
  console.error('Restore by hand from scripts/seed-show-visitor-info.ts before anything else.');
  console.error('='.repeat(78) + '\n');
  process.exitCode = EXIT_CODE_RESIDUE_ALERT;
}

// ---------------------------------------------------------------------------
// Needle discipline — the defect class this round exists to close
// ---------------------------------------------------------------------------
//
// A43 passed while the rule it guards was violated, because it read its expected value out of
// the same place as the actual value: it fetched pendingLabel from Sanity and looked for it in
// a page that renders pendingLabel from Sanity. Clear the field and the needle becomes '', at
// which point textContains short-circuits on `target.length > 0` and the check goes green with
// zero markers on the page.
//
// Rule for every check in this contract: a needle read from the dataset is INPUT, and input is
// validated at the boundary. An unusable needle is a hard failure of the check, never a
// silently skipped assertion.

export function assertUsableNeedle(reporter, label, value, { minLength = 3 } = {}) {
  const usable = typeof value === 'string' && value.trim().length >= minLength;
  reporter.check(
    usable,
    `needle "${label}" is usable (a blank needle would make every downstream assertion vacuous)`,
    `got ${JSON.stringify(value)}`,
  );
  return usable;
}
