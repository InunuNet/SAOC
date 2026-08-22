# Dataset Residue Guard

## The incident

**2026-08-15:** The `/national-show` page served `F3-TITLE-SENTINEL-1786560879358` as its H1 and displayed a countdown to `2098-12-31` — both test sentinel values. They sat live for ~3 days, discovered incidentally by an agent testing ticket purchases, not by any alarm.

**Root cause:** `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` writes sentinel values into the LIVE Sanity dataset to prove a CMS round trip, then restores the baseline in a `finally` block. That block already had:
- A crash guard
- `verifySustainedCondition` (verification that cleanup succeeded)
- `EXIT_CODE_RESIDUE_ALERT` (dedicated failure code)
- Durable logging

And it **still left three fields corrupted**. The residue alert fired into a log no human reads.

**Design lesson:** Hardening cleanup paths further is not the fix. The cleanup that failed was the most hardened one in the repo. The weak link was observability — the failure was invisible unless someone happened to read an unmonitored log. The fix is an always-on, independent detector wired somewhere failure is impossible to miss.

## What the tool does

`scripts/scan-dataset-residue.ts` is a read-only recursive scanner that walks every string and number field of every document in the Sanity dataset (or a local JSON fixture) and reports any value matching one of nine catalogued test-marker patterns.

### Two run modes

**Live mode** (default, no flags):
```bash
node --import tsx/esm scripts/scan-dataset-residue.ts
```
- Fetches all documents from the real Sanity dataset via the client API
- Uses `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, and `SANITY_API_TOKEN` from `.env.local` or the environment (read the same way `scripts/seed-page-singletons.ts` reads them — no `dotenv` package)
- This is what CI runs on every push, pull request, and daily at 03:00 UTC

**Fixture mode** (`--fixture <path>`):
```bash
node --import tsx/esm scripts/scan-dataset-residue.ts --fixture contracts/golden/dataset-residue-guard/fixture-clean.json
```
- Reads a local JSON array of plain document objects from `<path>`
- No credentials are read, constructed, or required
- No network call is made
- This is what the contract's assertions run against, to prove detection without mutating the live dataset

## How to read output

### Clean run
```
ALL CLEAR — scanned 42 document(s), no residue found.
```
Exit code: `0`

### Dirty run
```
nationalShow (nationalShow) . highlights[0].children[0].text = Come celebrate orchids in cultivation. F3-STAGES-SENTINEL-1786560879358
nationalShow (nationalShow) . countdownDate = 2098-12-31T22:00:00.000Z
FAIL: found 2 residue hit(s) across 42 document(s).
```
Exit code: `1` (non-zero)

Each hit line shows:
- Document ID and type (e.g., `nationalShow (nationalShow)`)
- Field path, including array indices and nested objects (e.g., `.highlights[0].children[0].text`)
- The value that matched a marker pattern

### Missing credentials (live mode only)
```
FAIL: missing NEXT_PUBLIC_SANITY_PROJECT_ID — cannot run live-mode residue scan. 
Set it in .env.local or the environment, or run with --fixture <path> instead.
```
Exit code: `1` (non-zero)

This is a loud, distinct hard failure, not a silent skip. If CI is wired to run live mode and credentials are missing or wrong, the job fails visibly.

## What to do when it fires

### 1. Identify the leaked fields

Read each hit line. The `fieldPath` and `value` tell you exactly where the residue is and what sentinel string or date was written.

Example: `nationalShow (nationalShow) . countdownDate = 2098-12-31T22:00:00.000Z` means the `nationalShow` document's `countdownDate` field has the far-future countdown value.

### 2. Find the correct baseline value

For `nationalShow`, the authoritative baseline is in `scripts/seed-page-singletons.ts` (lines 211–216):
```typescript
location: 'The Hangar, Stellenbosch Flying Club',
countdownDate: '2027-09-16T09:00:00+02:00',
```

**Do NOT use the baseline recorded in a check's own header comment** — the 2026-08-15 incident's comments mentioned `location = "Cape Town International Convention Centre"`, the invented placeholder that has since been corrected everywhere else. Trust the seed script, not the check comment.

### 3. Repair in Sanity Studio

1. Open https://saoc.sanity.build/studio (or your deployment's `/studio`)
2. Navigate to the document (e.g., `National Show`)
3. Edit the affected field(s) to the correct baseline value
4. Publish the changes
5. Run `curl -X POST http://localhost:3000/api/revalidate` (local) or hit the route on your deployed server to trigger on-demand ISR revalidation

**Timing note:** The site's cache is configured as `s-maxage=60, stale-while-revalidate=31535940`. After editing, the first page load still serves stale cache for up to 60 seconds. The ISR endpoint revalidates immediately, but stale-served responses may still be observed until the max-age window closes — wait at least 60 seconds before concluding the repair failed.

### 4. Verify the repair

Re-run the scanner:
```bash
node --import tsx/esm scripts/scan-dataset-residue.ts
```
It should exit 0 and print `ALL CLEAR`.

## Marker patterns

The scanner detects nine catalogued test-marker patterns, each traced to the specific check file that writes it. All matches are case-insensitive:

| Pattern | Example | Written by |
|---------|---------|-----------|
| `SVI-SENTINEL` | `SVI-PARKING-SENTINEL-1786481132420` | `contracts/checks/show-visitor-info/_mutation-guard.mjs` |
| `EXH-SENTINEL` | `EXH-DEADLINE-SENTINEL-1786482650802` | `contracts/checks/show-exhibitor-info/_mutation-guard.mjs` |
| `NOT-A-REAL-STATUS` | `not-a-real-status-42` | `contracts/checks/show-exhibitor-info/_mutation-guard.mjs` |
| `F3-SENTINEL` | `F3-TITLE-SENTINEL-1786560879358` | `contracts/checks/cms-loop-f3-national-show/` |
| `FAR-FUTURE-YEAR` | `2098-12-31`, `2099-01-01 00:00` | `contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` |
| `ZZCHECK-SENTINEL` | `ZZCHECK-ARCHIVEYEAR-LZ3K9F1` | `contracts/checks/cms-wiring-cleanup/_shared.mjs` |
| `F6-LOOP-PROOF` | `F6-LOOP-PROOF-1786560879358-a3f912` | `contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs` |
| `SENTINEL` (catch-all) | Any string containing the word `SENTINEL` | Every mutating check |
| `EPOCH-MS-NONCE` (heuristic) | `1786560879358` (embedded 13-digit epoch-ms timestamp) | General shape used across checks as a nonce/suffix |

The scanner also detects these markers split across Portable Text block spans (consecutive rich-text marks like bold or links). A marker like `F3-TITLE-SENTINEL-1786560879358` split as `F3-TITLE-SENT` + `INEL-17865...` is caught by concatenating the block's span text.

For complete details on every pattern and its source, see `contracts/golden/dataset-residue-guard/marker-catalogue.md`.

## CI and gate wiring

### GitHub Actions (daily and per-push coverage)

The scanner runs as its own dedicated job in `.github/workflows/ci.yml`, separate from the main `ci:` build job:

```yaml
dataset-residue-guard:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - name: Scan live Sanity dataset for test residue
      env:
        NEXT_PUBLIC_SANITY_PROJECT_ID: ${{ secrets.NEXT_PUBLIC_SANITY_PROJECT_ID }}
        NEXT_PUBLIC_SANITY_DATASET: production
        SANITY_API_TOKEN: ${{ secrets.SANITY_API_TOKEN }}
      run: node --import tsx/esm scripts/scan-dataset-residue.ts
```

It triggers on:
- Every push to `main`
- Every pull request targeting `main`
- A daily schedule: `0 3 * * *` (03:00 UTC) — a backstop for residue written outside a PR

The job is separate (not a step inside `ci:`) because it needs `SANITY_API_TOKEN`, a RUNTIME-only credential that the build job explicitly excludes from its documented env block. Keeping them separate also makes a residue finding fail loudly under its own job name in the GitHub UI.

### Contract gate (local and every mission)

As of 2026-08-22, every local `pnpm gate` run (and every mission's CI contract invocation) now executes the scanner twice — **pre-flight** (before running any assertion) and **post-flight** (after all assertions complete). This closes a critical observability gap: the nightly GitHub Actions job is surveillance-only, available only if someone happens to check the CI tab. A residue finding during a local gate run is loud and immediate.

**Why pre-flight:** A poisoned dataset (one already holding residue) makes every mutating check's captured baseline untrustworthy. A check that reads "parking info is SVI-PARKING-SENTINEL-..." as its baseline, then writes a new sentinel value, then reads the new value back, will report "baseline and restored value match" — a false clean — because both are sentinels. Pre-flight scan catches and blocks this before it can happen.

**Why post-flight:** Catches residue a gate run itself just introduced, making failure immediate and local rather than delaying discovery to the next nightly scan.

**How to test the gate integration** (proving the gate refuses to run against poisoned data without hitting live credentials):

```bash
# Against a known-bad fixture, the gate must refuse to proceed
python3 execution/checks/verify_gate_residue_preflight.py
```

This test runs the actual `execution/contract.py gate` command against a fixture pointing to `contracts/golden/dataset-residue-guard/fixture-all-patterns.json` (containing every known sentinel pattern), then verifies the gate exited with the residue-specific exit code before any assertion's own output appeared. A positive control in the same test verifies that pointing the gate at a known-clean fixture proceeds normally.

If the test script is missing or the fixture path is stale, see `contracts/golden/dataset-residue-guard/README.md` for the fixture inventory and structure.

## Honest limits

### No branch protection on `main`

**Confirmed via `gh api repos/InunuNet/SAOC/branches/main/protection` returning 404.** `main` has no branch protection, so a red `dataset-residue-guard` job **does not block merges**. It is advisory only, exactly like the log-based residue alert this scanner exists to replace.

**Outstanding human action:** Brad must enable branch protection at https://github.com/InunuNet/SAOC/settings/branches:
- Add a rule for `main`
- Require status checks: `ci` and `dataset-residue-guard`
- Enforce admins

Until then, do not describe this guard to anyone as "impossible to miss" — describe it as "detects on a daily schedule and on every push/PR, does not yet block merges."

### Detection latency

- **On PR or push:** same-day visibility
- **Outside a PR/push window:** up to 24 hours (bounded by the daily 03:00 UTC cron)

The 2026-08-15 residue sat for ~3 days because it was written between PRs. With the daily cron, it would have been caught within 24 hours. This is adequate for a test-data detector (not a real-time monitor), but not instant.

### Known false-positive shapes

Two patterns can match non-residue content once numeric leaves are coerced through pattern matching (both documented, not silent gaps):

1. **EPOCH-MS-NONCE** (`/(?<!\d)\d{13}(?!\d)/`, pattern #9): A JavaScript number like `1.78e12` stringified to exponential form produces `"1780000000000"` (13 digits), or a negative number like `-1786560879358` has a trailing 13-digit run that still matches. These are treated as "flag for human review", not automatic incident.

2. **FAR-FUTURE-YEAR** (2026-08-16 tightening): Originally an unanchored `/20(9[0-9])/` that false-positived on ordinary numeric fields (e.g., a ticket price of `2099`). Tightened to `/20(9[0-9])-\d{2}-\d{2}/` to require ISO date context. Still catches the real incident (`2098-12-31T22:00:00.000Z`) and documented countdown values (`2099-01-01 00:00`). Hits on patterns #1–#8 remain unambiguous.

### QA round findings (August 2026)

Four real defects were found after the scanner shipped and green gates passed:

1. **Portable Text span-split detection** — markers split across adjacent rich-text spans were invisible; fixed by concatenating block span text and testing joined.
2. **Non-string leaf detection** — numeric fields like `countdownEpoch: 1786560879358` were skipped; fixed by coercing numbers through pattern tests.
3. **Detection cadence** — job only triggered on push/PR, missing quiet stretches; fixed by adding daily cron.
4. **Case sensitivity** — patterns like `f3-title-sentinel` (lowercase) slipped through; fixed by adding `/i` flags to six patterns.

**The durable lesson:** A green gate proves the assertions, not the property. Automation cannot see rendered output, behavioral correctness, or integration with live infrastructure. For residue detection specifically: a green contract gate proved the scanner code, not that the live dataset stayed clean. Only independent, always-on monitoring running against the real dataset provides that guarantee — which is exactly why this scanner exists separate from the check cleanup logic it guards.

### Fixture-authoring rule

If you add a new fixture to `contracts/golden/dataset-residue-guard/`, do not name any `_id` or `_type` field with a marker substring (e.g., `doc-sentinel`, `fixture-f3-test`). A document ID containing `SENTINEL` triggers the catch-all pattern and makes the fixture unusable for testing. Exercise every marker pattern via a field *value*, never via a document identifier. This avoids false positives and ensures fixture design doesn't weaken real production detection.

## Running locally

**Live mode** (requires `.env.local` with Sanity credentials):
```bash
node --import tsx/esm scripts/scan-dataset-residue.ts
```

**Fixture mode** (network-free, no credentials needed):
```bash
node --import tsx/esm scripts/scan-dataset-residue.ts --fixture contracts/golden/dataset-residue-guard/fixture-clean.json
```

Test fixtures are in `contracts/golden/dataset-residue-guard/`:
- `fixture-clean.json` — all-clear baseline
- `fixture-dirty-nested.json` — residue 4 levels deep
- `fixture-span-split-residue.json` — marker split across Portable Text spans
- `fixture-all-patterns.json` — one hit per catalogued pattern

## See also

- `contracts/golden/dataset-residue-guard/README.md` — full design rationale
- `contracts/golden/dataset-residue-guard/marker-catalogue.md` — every pattern's source and false-positive risk
- `contracts/contract-dataset-residue-guard.yaml` — 14 assertions; the contract gates all of the above
