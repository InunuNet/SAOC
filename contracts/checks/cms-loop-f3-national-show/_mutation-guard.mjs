// cms-loop-f3-national-show — dataset mutation safety for check-headline-round-trip.mjs (A1).
//
// WHY THIS FILE EXISTS
// ---------------------
// A1 writes real sentinel values (title/location/countdownDate) into the live `nationalShow`
// singleton via the Studio UI to prove the CMS round-trip loop, then restores them. Until this
// file existed it had no cross-process lock, no poisoned-baseline rejection, and no
// revision-guarded restore — unlike its siblings under contracts/checks/show-visitor-info/ and
// contracts/checks/show-exhibitor-info/, which were hardened with exactly those three defences
// on 2026-08-12 (commit c5240ed). That hardening pass never touched this contract despite its
// own commit message claiming otherwise. Worse, contracts/checks/show-visitor-info/
// check-show-identity-sweep.mjs mutates the SAME `nationalShow` document under a DIFFERENT,
// non-shared lock file, so the two have never actually serialised against each other. This is
// the confirmed root cause behind two live `nationalShow` sentinel-residue incidents — see
// .agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/goldens/m1-golden.md.
//
// Three independent defences, same shape as the sibling guards, because any one alone can be
// bypassed:
//
//   1. POISONED-BASELINE REJECTION. A baseline that looks like ANY check's sentinel — not just
//      this contract's own F3- prefix — is a hard failure, never a value we restore. Recognising
//      the full dataset-residue-guard marker catalogue (scripts/scan-dataset-residue.ts) here,
//      not just F3-, matters because check-show-identity-sweep.mjs's own sentinels land in the
//      same document and must be equally unrestorable if A1 captures them as its baseline.
//   2. A SHARED, DOCUMENT-SCOPED EXCLUSIVE LOCK (docLockPath('nationalShow')), the same file
//      show-visitor-info's guard now locks on — see contracts/checks/_shared/doc-lock-path.mjs.
//      Held for the whole mutate/verify/restore window, released in a `finally`.
//   3. A REVISION-GUARDED RESTORE. The restore patches with `ifRevisionID` set to the revision
//      OUR sentinel write produced. If anything wrote to the document in between, the restore
//      fails loudly instead of silently clobbering a concurrent writer's value.

import { mkdirSync, openSync, closeSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { docLockPath, makeLockToken } from '../_shared/doc-lock-path.mjs';

export const EXIT_CODE_RESIDUE_ALERT = 2;

// Recognises the FULL dataset-residue-guard marker catalogue (see
// scripts/scan-dataset-residue.ts's MARKER_PATTERNS and
// contracts/golden/dataset-residue-guard/marker-catalogue.md), not only this contract's own
// F3- prefix — a baseline poisoned by a DIFFERENT check's sentinel (e.g. show-visitor-info's
// SVI- or check-show-identity-sweep's own markers, both of which can land in this same
// document) is exactly as unrestorable as one poisoned by A1's own prior run.
export const SENTINEL_TEXT_PATTERNS = [
  /F3-[A-Z]+-SENTINEL-\d+/i,
  /SVI-[A-Z0-9-]*SENTINEL-\d+/i,
  /EXH-[A-Z0-9-]*SENTINEL-\d+/i,
  /not-a-real-status-\d+/i,
  /ZZCHECK-[A-Z0-9]+-[A-Z0-9]+/i,
  /F6-LOOP-PROOF-\d+-[a-f0-9]+/i,
  /SENTINEL/i,
  // Mirrors scan-dataset-residue.ts's 9th catalogue pattern (EPOCH-MS-NONCE) — a bare
  // 13-digit Date.now() nonce, the shape this contract's own `nonce` constant produces.
  // Missing here meant a baseline shaped like that nonce (not prefixed with F3-/SVI-/etc.)
  // was silently ACCEPTED as usable and could be restored during cleanup.
  /(?<!\d)\d{13}(?!\d)/,
];

// countdownDate is a datetime, not free text — its sentinel shape is a far-future year
// (2098/2099, this contract's own SENTINEL_DATETIME_INPUT), matching the residue scanner's own
// FAR-FUTURE-YEAR pattern.
const FAR_FUTURE_YEAR = /^20(9[0-9])-/;

export function looksLikeSentinelText(value) {
  return typeof value === 'string' && SENTINEL_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

export function looksLikeSentinelDate(value) {
  return typeof value === 'string' && FAR_FUTURE_YEAR.test(value);
}

// ---------------------------------------------------------------------------
// Defence 1 — poisoned baseline
// ---------------------------------------------------------------------------

export class PoisonedBaselineError extends Error {}

// A baseline is only usable if it is real editorial content: non-empty, and not shaped like any
// known sentinel. A sentinel-shaped baseline is a LIVE INCIDENT, not a bad input — it means an
// earlier run (this contract's or a sibling's) left residue that has been rendering on the live
// site. Refuse to start; restoring it would make the residue permanent. `isDate` selects the
// far-future-year check instead of the generic text patterns, since countdownDate's stored ISO
// value never matches the F3-/SVI-/EXH- text shapes.
export function assertUsableBaseline(field, value, { isDate = false } = {}) {
  const poisoned = isDate ? looksLikeSentinelDate(value) : looksLikeSentinelText(value);
  if (poisoned) {
    throw new PoisonedBaselineError(
      `POISONED BASELINE — ${field} currently holds ${JSON.stringify(value)}.\n` +
        'That is a sentinel left behind by an earlier check run (this contract\'s or a ' +
        'sibling\'s), which means it has been RENDERING ON THE LIVE SITE. This check refuses ' +
        'to start, because restoring this value would make the residue permanent.\n' +
        'Restore the field from scripts/seed-page-singletons.ts, verify the rendered page ' +
        '(and run node --import tsx/esm scripts/scan-dataset-residue.ts to confirm the whole ' +
        'dataset is clean), then re-run.',
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
// Defence 2 — exclusive lock, shared with show-visitor-info via docLockPath('nationalShow')
// ---------------------------------------------------------------------------

export const LOCK_PATH = docLockPath('nationalShow');
const LOCK_DIR = path.dirname(LOCK_PATH);
const LOCK_WAIT_TIMEOUT_MS = 420_000;
const LOCK_POLL_MS = 3_000;
const LOCK_STALE_MS = 1_200_000;

export function readLock() {
  try {
    return JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function lockFileAgeMs() {
  try {
    return Date.now() - statSync(LOCK_PATH).mtimeMs;
  } catch {
    return Infinity;
  }
}

// signal 0 performs the permission/existence check without delivering anything. EPERM means the
// process exists and belongs to another user — alive, and not ours to reap.
export function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

// Writes the same lock-file shape ({owner, pid, token, at}) show-visitor-info's guard writes,
// via the shared makeLockToken() — this contract's lock file used to omit `token` entirely,
// which meant show-visitor-info's release path (guarded only against a MISMATCHED token, not a
// MISSING one) could delete a live lock this guard held out from under it. See F3 in
// fix-live-sentinel-residue-cms-loop-f3 and the matching comment on show-visitor-info's
// releaseLock().
export function tryAcquire(owner, token) {
  mkdirSync(LOCK_DIR, { recursive: true });
  let fd;
  try {
    // 'wx' fails if the path exists — the atomicity this whole mechanism rests on.
    fd = openSync(LOCK_PATH, 'wx');
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return false;
  }
  try {
    writeFileSync(fd, JSON.stringify({ owner, pid: process.pid, token, at: Date.now() }));
  } finally {
    closeSync(fd);
  }
  return true;
}

// Token match is authoritative — it identifies THIS specific acquisition, unlike pid/owner
// which a recycled pid or a same-named contender could coincidentally match.
function weStillHold(token) {
  const current = readLock();
  return current?.token === token;
}

export function releaseIfOurs(owner, token, { quiet = false } = {}) {
  if (!weStillHold(token)) {
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

// Runs `fn` with exclusive access to the shared `nationalShow` lock. Both A1
// (check-headline-round-trip.mjs) and show-visitor-info's check-show-identity-sweep.mjs MUST go
// through their respective guard's withDatasetLock — a check that writes outside the lock
// reopens the interleaving hole this file exists to close.
export async function withDatasetLock(owner, fn) {
  const start = Date.now();
  const token = makeLockToken();
  let held = false;

  while (!held) {
    if (tryAcquire(owner, token)) break;
    const existing = readLock();
    const age = existing?.at ? Date.now() - existing.at : lockFileAgeMs();

    if (existing && 'pid' in existing && !isPidAlive(existing.pid)) {
      console.warn(
        `  [lock] REAPING a lock held by a DEAD process: ${existing.owner ?? 'unknown'} ` +
          `(pid ${existing.pid}, ${Math.round(age / 1000)}s old).`,
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

  const onSignal = (signal) => {
    console.error(`\n  [lock] ${signal} received — releasing the dataset lock before exiting.`);
    releaseIfOurs(owner, token, { quiet: true });
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
    releaseIfOurs(owner, token);
  }
}

// ---------------------------------------------------------------------------
// Defence 3 — revision-guarded restore
// ---------------------------------------------------------------------------

// Applies a patch and returns the resulting revision, so the caller can require that exact
// revision to still be current when it restores.
export async function commitAndCaptureRev(client, docId, values) {
  const result = await client.patch(docId).set(values).commit();
  return result._rev;
}

// Restores `values`, but only if the document is still at `expectedRev` — i.e. only if nothing
// else has written since our own sentinel landed. A concurrent write makes this throw loudly
// instead of silently clobbering whatever the other writer had done.
export async function restoreGuarded(client, docId, values, expectedRev) {
  return client.patch(docId, { ifRevisionID: expectedRev }).set(values).commit();
}

export function isRevisionConflict(err) {
  return err?.statusCode === 409 || /revision/i.test(err?.message ?? '');
}
