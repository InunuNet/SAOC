// _shared/doc-lock-path.mjs — the single canonical lock-file-path function for a given
// Sanity document id, shared across every contract that mutates live content.
//
// WHY THIS FILE EXISTS
// ---------------------
// `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` (A1) and
// `contracts/checks/show-visitor-info/check-show-identity-sweep.mjs` both mutate the SAME
// live `nationalShow` singleton, but until this file existed they did so under two
// different, unrelated lock files — A1 had no lock at all, and show-visitor-info's
// `_mutation-guard.mjs` locked on a contract-scoped `show-visitor-info-dataset.lock`. Two
// checks that write the same document but never take the same lock have never actually
// serialised against each other: this is the confirmed root-cause gap behind the live
// `nationalShow.title`/`location`/`countdownDate` sentinel-residue incidents (see
// .agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/goldens/m1-golden.md).
//
// This file does not implement locking itself (acquire/release/staleness/liveness) — each
// contract's own mutation guard keeps its own proven lock mechanics. It only computes the
// PATH both guards lock on, keyed by document id, so two contracts mutating the same
// document land on the same file no matter which guard's implementation acquires it.
//
// Rooted under the same `saoc-contract-locks` tmp convention every existing lock file
// already uses, so old and new callers land in the same directory.

import os from 'node:os';
import path from 'node:path';

const LOCK_DIR = path.join(os.tmpdir(), 'saoc-contract-locks');

// TEST-ONLY OVERRIDE. Real mutating checks never set this — it exists so
// check-lock-safety.mjs (both contracts' copies) can prove real cross-contract mutual
// exclusion by pointing the REAL docLockPath() at a throwaway sandbox path instead of a
// mocked/reimplemented one. Every caller resolves the SAME path whenever this is set,
// which is what makes the resulting test meaningful: it exercises the actual function
// both guards call, not a stand-in for it.
const OVERRIDE_ENV_VAR = 'SAOC_DOC_LOCK_PATH_OVERRIDE';

// Returns the shared, canonical lock-file path for a given Sanity document id. Two
// callers that pass the same docId always compute the same path, which is the entire
// point — do not let a caller append its own contract-scoped suffix to this value.
export function docLockPath(docId) {
  if (typeof docId !== 'string' || docId.trim() === '') {
    throw new Error('docLockPath requires a non-empty document id string');
  }
  const override = process.env[OVERRIDE_ENV_VAR];
  if (override) return override;
  return path.join(LOCK_DIR, `${docId}-dataset.lock`);
}

// A token unique to one lock acquisition, so a release can only ever remove the lock file
// belonging to that specific acquisition — never a lock some other holder (including the OTHER
// contract's guard, now that both share docLockPath('nationalShow')) legitimately took over the
// same path afterwards. Shared here so every guard that locks on a docLockPath() writes and
// checks the identical token shape; a guard that invents its own token format defeats the
// cross-guard match this exists for. See fix-live-sentinel-residue-cms-loop-f3 F3: before this
// was shared, cms-loop-f3-national-show's guard wrote lock files with no token at all, so
// show-visitor-info's release path — which only refuses to delete when the on-disk token exists
// AND mismatches — fell through and deleted a live, token-less cms-loop-f3 lock out from under it.
export function makeLockToken() {
  return `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
