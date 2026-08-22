# Fixing Live Sentinel Residue in CMS Loop F3

**Mission:** `fix-live-sentinel-residue-cms-loop-f3` (M1, completed 2026-08-22)  
**Status:** All three features shipped; live production clean  
**Key dates:**
- 2026-08-15: First incident (residue served on `/national-show` for ~3 days)
- 2026-08-21/22: Second incident (countdownDate field held `2098-12-31T22:00:00.000Z`)
- 2026-08-22: This mission's root-cause investigation and fixes shipped

This mission addresses a critical defect class: contract checks that write intentionally to the live production Sanity dataset to prove a feature (like CMS round-trip wiring) but fail to clean up reliably, leaving test sentinel values visible to visitors.

---

## What happened: the two incidents

### Incident 1: 2026-08-15
`/national-show` served the H1 "F3-TITLE-SENTINEL-1786560879358" and a countdown to "2098-12-31" — both test markers intentionally written by `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` (contract assertion A1). The residue sat live and visible for ~3 days, discovered incidentally during an agent testing ticket purchases, not by any alarm.

### Incident 2: 2026-08-21/22
During this mission's own investigation (while running an unrelated mission), `nationalShow.countdownDate` was found holding `2098-12-31T22:00:00.000Z` — the same test value. A second independent sweep during investigation found `title` and `location` freshly corrupted with `F3-TITLE-SENTINEL-1787355547212` and `F3-LOCATION-SENTINEL-1787355547212` (nonce decodes to 2026-08-21T23:39:07Z — minutes before the check ran). This proved A1 was re-triggered during the current session, and cleanup failed again.

### Why both failed
1. **No cross-process mutual exclusion:** A1 had no lock file at all. Its sibling `contracts/checks/show-visitor-info/check-show-identity-sweep.mjs` mutates the same `nationalShow` singleton but used a completely separate lock file (`show-visitor-info-dataset.lock`). The two checks could interleave their mutations and restorations, corrupting the other's baseline capture.

2. **Studio-based restore was fragile:** A1's cleanup step re-opened the Sanity Studio UI and re-published the page — a roundabout path that was fragile and has now failed twice.

3. **Alerts went nowhere:** A1's own `raiseResidueAlert` path exists but either never fired (process killed mid-run) or fired silently into a log nobody monitors.

4. **Detection was nightly-only:** `scripts/scan-dataset-residue.ts` runs on a GitHub Actions cron, visible only if someone checks the CI tab. Both incidents sat undetected in production — the first for ~3 days, the second for minutes during active investigation.

---

## The three-part fix

### F1: Close the concurrency gap with a shared, document-scoped lock

**Files created:**
- `contracts/checks/_shared/doc-lock-path.mjs` — exports `docLockPath(docId)`, computes a lock path as `path.join(os.tmpdir(), 'saoc-contract-locks', '${docId}-dataset.lock')`

**Files modified:**
- `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` — retrofitted with:
  1. **Poisoned-baseline rejection** — checks `title`, `location`, and `countdownDate` before any mutation; refuses to proceed if any match a sentinel pattern
  2. **Shared exclusive lock** — wraps the entire mutate → verify → restore flow in `withDatasetLock` using `docLockPath('nationalShow')`
  3. **Revision-guarded restore** — replaces the Studio re-publish with a direct `client.patch('nationalShow', { ifRevisionID: capturedRev }).set(baseline).commit()`. If a concurrent writer lands between capture and restore, the conditional `ifRevisionID` makes the restore throw rather than silently clobbering.
- `contracts/checks/show-visitor-info/_mutation-guard.mjs` — **now uses the shared lock** via `docLockPath('nationalShow')` instead of its own hardcoded path, so the two contracts that mutate the same singleton now actually serialize against each other for the first time

**Why this matters:** The two contracts that both write to `nationalShow` now cannot interleave. A1's cleanup (Studio-based) was fragile; moving it to a direct `ifRevisionID`-guarded client patch makes it deterministic and atomic.

### F2: Wire the detector into the gate command so residue detection is loud and local

**Files created:**
- `execution/checks/verify_gate_residue_preflight.py` — a test that proves the gate refuses to run against poisoned data without hitting live credentials

**Files modified:**
- `execution/contract.py` — `gate_cmd` now invokes `scripts/scan-dataset-residue.ts` twice:
  - **Pre-flight** (before any assertion runs) — catches existing residue that would poison all captured baselines
  - **Post-flight** (after all assertions complete) — catches residue the gate run itself just introduced

The scanner exits with a distinct, documented exit code (`RESIDUE_SCAN_ERROR_EXIT_CODE=5`) on confirmed residue, distinct from assertion failures, so the two failure modes are never conflated.

**Why this matters:** Residue finding is no longer "invisible unless someone reads GitHub Actions" — it's now impossible to run a gate without knowing whether the dataset is clean.

### F3: Live production sweep and verification

**Performed during investigation:**

Live production `nationalShow` was patched directly to restore correct values for `title` and `location` (sourced from `scripts/seed-page-singletons.ts:212,214` and cross-checked against the sibling `show-19-2027` document).

A full sweep of `nationalShow`, `show-19-2027`, and `societyEvent-15-19th-south-african-national-orchid-show` via `scripts/scan-dataset-residue.ts` confirmed clean: `ALL CLEAR — scanned 148 document(s), no residue found.`

---

## How to verify this works

### Local gate run refuses to proceed against poisoned data
```bash
# Test the gate integration against a fixture
python3 execution/checks/verify_gate_residue_preflight.py
```

This runs the actual gate command against a fixture holding all known sentinel patterns and verifies:
1. The gate exits with the residue-specific code before any assertion's output appears
2. A positive control pointing at a clean fixture proceeds normally

### Live dataset stays clean
```bash
# Scan live production for residue
node --import tsx/esm scripts/scan-dataset-residue.ts
```

Should exit 0 and print `ALL CLEAR`.

### The shared lock works
```bash
# Two concurrent contract runs now serialize on the same lock
node contracts/checks/cms-loop-f3-national-show/check-lock-safety.mjs
```

This test launches two concurrent acquirers of `docLockPath('nationalShow')` — one from cms-loop-f3-national-show, one from show-visitor-info — and verifies the second blocks until the first releases.

---

## Design rationale

### Why a document-scoped lock, not a global one?
If a third contract later mutates a different document (e.g., `showExhibitorInfo`), it should not be blocked by a `nationalShow` mutation. The lock is keyed by the document ID being mutated, so concurrent mutations of different documents can proceed in parallel.

### Why both pre-flight AND post-flight scans?
Pre-flight catches accumulated residue that would poison all checks. Post-flight catches freshly-introduced residue. Together they provide confidence: if the gate runs green with both scans passing, the dataset is clean before and after, making captured baselines trustworthy.

### Why revision-guarded restore instead of Studio re-publish?
Studio re-publish is a human workflow: open the doc, click publish. It's slow, fragile to network delays, and (as we've seen) can be interrupted. A direct client patch with `ifRevisionID` is atomic and deterministic — if a concurrent write lands, the patch throws loudly rather than silently losing work.

---

## Technical details

### The sentinel patterns A1 checks for
Before any mutation, A1 now rejects if `title`, `location`, or `countdownDate` match any of these patterns:
- `SVI-*-SENTINEL-*` (show-visitor-info residue)
- `EXH-*-SENTINEL-*` (show-exhibitor-info residue)
- `F3-*-SENTINEL-*` (cms-loop-f3-national-show residue)
- `ZZCHECK-*-SENTINEL-*` (other contracts)
- Any string containing `SENTINEL` (catch-all)
- `20(9[0-9])-\d{2}-\d{2}` (far-future dates like 2098-12-31)

See `docs/dataset-residue-guard.md` for the complete marker catalogue and false-positive mitigations.

### Draft-residue cleanup improvements
During investigation, the draft-residue cleanup path (handling `drafts.${TARGET_DOC_ID}` left by partially-landed Studio autosaves) was hardened three more times:
1. **Partial-sentinel-match detection** — now triggers on ANY field looking sentinel-shaped, not requiring all three fields to match exactly
2. **Full-document fetch before deciding** — reads the draft completely before deciding delete-vs-clean
3. **Fallback revision guarding** — the cleanup's fallback path (if the sentinel publish never confirmed) also uses `ifRevisionID` on `baseline._rev`, preventing concurrent edits from being clobbered

---

## Related documentation
- `docs/dataset-residue-guard.md` — the scanner tool and all marker patterns
- `docs/show-visitor-info.md` — details on the shared lock migration
- `.agent/memory/project/specs/fix-live-sentinel-residue-cms-loop-f3/contract-m1.yaml` — 15 assertions proving all of the above
- Project memory `project_contract_checks_mutate_live_content.md` — incident tracking for this defect class

---

## Operational notes for maintainers

### A1 still uses Studio to prove the CMS edit → Sanity write path
The initial mutation (writing sentinel values) still goes through the Sanity Studio UI — that's the point of A1, proving the editor workflow. Only the **restore** moved to a client patch. If A1 ever stops mutating via Studio (e.g., if the Studio UI changes), its mechanism changes but its purpose (proving round-trip wiring) remains what drives its design.

### Expect the gate to take 10–15 minutes
The four mutating checks in this contract (`check-cms-round-trip`, `check-seed-idempotent`, `check-marker-fail-closed`, `check-show-identity-sweep`) now share one lock and run serially by design. They also all poll for CDN propagation (up to 1200s for `check-show-identity-sweep`). That is the cost of assertions that can actually fail — a fast gate proves nothing about data integrity.

### If you see a sentinel on a live page
1. Treat it as a live content incident — it is visible to anyone visiting the site.
2. In Studio, replace the field with its correct seeded value (check `scripts/seed-page-singletons.ts` for the baseline).
3. Publish, then verify via `curl` + regex or `scripts/scan-dataset-residue.ts` that it's gone (allow ~90s for the ISR window).
4. Check for a stale lock file (`ls -la /tmp/saoc-contract-locks/`) or a gate timeout log — that indicates a killed process.

---

## Timeline and related incidents

This mission is the second occurrence of the "contract checks mutate live content" defect class. See project memory `project_contract_checks_mutate_live_content` for the full incident log and the first occurrence (2026-08-15/16). The gap between the two incidents was ~6 days; both went undetected by nightly automation until discovered during active investigation or incident response.
