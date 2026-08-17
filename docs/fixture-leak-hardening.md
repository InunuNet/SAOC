# Firestore Fixture Leak Hardening

**Contract:** `contracts/contract-payfast-m1-lock-cleanup-fix.yaml` (24/24). Gated green.

**Status:** Two measured fixture-leak paths in the `tickets` collection have been sealed. The hardening follows [the lesson from dataset residue guard](dataset-residue-guard.md) — failures in resource cleanup remain invisible unless observed independently. This document explains *what was leaking, what changed, and how each fix is verified*.

---

## The Problem — Two Leak Paths

### Path 1: Sentinel domain blindness (dormant, 7 surviving docs)

The fixture-cleanup helper `contracts/checks/ticketing-hardening/_shared.mjs` used a single hardcoded sentinel marker (`@harden-check.invalid`) to tag test documents. Any check that wrote test data with a *different* sentinel-shaped domain (e.g. `@payfast-m1-check.invalid`) became structurally invisible to `withCleanup()` forever. 

**Evidence:** Seven surviving `"Proof"` documents in the `tickets` collection carry `@payfast-m1-check.invalid` from a superseded pre-`f87bcb3` script. These sat live for an unknown duration until the new stricter detection measured the delta.

**Fix:**
- Unified all sentinel domains into a shared registry: `contracts/checks/_shared/sentinel-domains.mjs`
- `withCleanup()` now pattern-matches ANY domain in the registry, not just one hardcoded value
- Existing blind docs are harmless; deletion is Brad's decision

### Path 2: Timeout ceiling below lock-wait ceiling (was active, 10 docs in two batches)

Firestore fixture cleanup runs inside `withCleanup()`'s `finally` block, which survives assertion failures but not process kills. The kill signal came from `execution/contract.py`, which had:
- Shell assertion timeout: 60 seconds
- `contracts/checks/ticketing-hardening/_shared.mjs`: `LOCK_WAIT_MS = 90_000` (90 seconds)

**The race:** A check could take 60–89 seconds (within the lock wait), then the assertion-level kill at 60s happened *before* the awaited Firestore cleanup sweep completed. On SIGKILL, the lock released (via `process.on('exit')` sync handler), but the awaited cleanup in `finally` never ran.

**Evidence:** Ten documents in two batches 2 minutes apart, each cut off at the same scenario. `LOCK_WAIT_MS` was deliberately chosen at 90s to fix a 2026-08-12 A7 timing flake; lowering it would reopen that flake.

**Fix:** Raise assertion timeouts instead:
- A18–A21: 120 seconds
- A30/A31: 150 seconds
- A34: 180 seconds

This inverts the hierarchy so process kill happens *after* cleanup completes.

---

## Secondary Hardening: Lock-Timeout Invariant

The `contracts/checks/ticketing-hardening/_shared.mjs` lock-timeout invariant check originally followed only ONE hardcoded re-export hop (A5 assertions). This was defeated via a barrel import — a re-export chain that the check never traversed.

**Fix:** Generic recursive cycle-safe text-based walk of the entire import graph. The barrel-import evasion is committed as a permanent negative control (`A21-BARREL-IMPORT-EVASION-CONTROL`), proving the new walk catches it.

**Remaining ceiling:** Bare/aliased specifiers that secretly resolve to `_shared.mjs` are skipped as external (ESM-only codebase — `require()` is unmatched). This is an acceptable boundary.

---

## Verification

**Fixture manifest + always-run preflight sweep (A3–A4):**
- Before any fixture cleanup, enumerate and snapshot which documents exist in `tickets`
- After cleanup, re-scan and verify the exact set is gone
- Survives SIGKILL because the preflight is independent, runs first, and persists to disk

**Delta identity check (A34):**
- Replaces an earlier count-delta check that couldn't distinguish "no new docs" from "missing detector"
- New form: compare identity sets (before/after) and prove the difference is exactly the expected cleanup set
- Includes its own spawn timeout (180s) and kill-and-recover capability proof

---

## Known Limitations

- The seven Path 1 blind docs remain live in Firestore. Deletion is Brad's call.
- A34 environmental RED: Requires the live `tickets` collection residue-free. ~15 pre-existing `@harden-check.invalid` docs prevent A34 from passing until they are deleted.
- Path 1 detection works only for domains in the unified registry; future sentinel changes must update the registry.

---

## Related

- [Dataset Residue Guard](dataset-residue-guard.md) — observability lesson this hardening follows
- [Ticketing Hardening](ticketing-hardening.md) — the broader security/correctness fixes to ticketing
- [PayFast Integration](payfast-integration.md) — payment flow context
