# dataset-residue-guard — golden reference

## Incident this closes

2026-08-15: `/national-show` served `title = "F3-TITLE-SENTINEL-1786560879358"` and
`countdownDate = 2098-12-31` live for ~3 days. Root cause:
`contracts/checks/cms-loop-f3-national-show/check-headline-round-trip.mjs` writes
sentinel values into the LIVE dataset to prove a CMS round trip, then restores the
baseline in a `finally` block. That block already has a crash guard,
`verifySustainedCondition`, `EXIT_CODE_RESIDUE_ALERT`, and durable logging — and it
still left three fields corrupted. Hardening the cleanup path further is not the fix;
the cleanup path that failed was already the most hardened one in the repo. The
residue alert it raises fires into a log no human reads.

**Countermeasure:** an always-on detector independent of any single check's cleanup
logic, wired somewhere a failure is impossible to miss (CI, gating the build).

> **Delivery status (added on QA amendment, 2026-08-16 — read before trusting the
> phrase "impossible to miss" above):** what ships from this contract is the scanner
> (F1) and a scheduled + push/PR-triggered CI job (F2, amended). That is real
> detection running on a fixed cadence. It is **not** enforcement: `main` has **no
> branch protection** (confirmed via `gh api repos/InunuNet/SAOC/branches/main/protection`
> returning 404 "Branch not protected" during QA on this amendment). Without branch
> protection requiring the `dataset-residue-guard` check, a red job blocks nothing —
> it is advisory only, exactly like the residue alert this whole contract exists to
> replace, until a human enables it. See "Outstanding human action" below. Until that
> action is taken, do not describe this guard to anyone as "impossible to miss" —
> describe it as "detects on a daily schedule and on every push/PR, does not yet
> block merges."

## Scanner design (binding on `scripts/scan-dataset-residue.ts`)

### Two run modes — this is the core testability decision

The live dataset is clean today (verified 2026-08-12 after repair) and must stay
that way. A test that proves detection by writing a sentinel to the live dataset
would recreate the exact bug it's guarding against ("prove you can detect test data
in production by writing test data to production"). So the scanner supports:

- **Live mode** (default, no flags): fetches all documents from the real Sanity
  dataset via `client.fetch('*[]{ ... }')` using `NEXT_PUBLIC_SANITY_PROJECT_ID` /
  `NEXT_PUBLIC_SANITY_DATASET` / `SANITY_API_TOKEN` read the same way
  `scripts/seed-page-singletons.ts` reads them (see that file's header comment: no
  `dotenv` package, because its startup banner has corrupted an env value on this
  project before). This is what CI runs.
- **Fixture mode** (`--fixture <path>`): reads a local JSON array of plain document
  objects from `<path>` instead of calling the network at all. No credentials are
  read, constructed, or required in this mode. This is what the contract's
  assertions run against — see `fixture-clean.json` and `fixture-dirty-nested.json`
  in this directory.

`--fixture` must short-circuit *before* any Sanity client is constructed — the
contract's A1/A2 assertions run with `SANITY_API_TOKEN`,
`NEXT_PUBLIC_SANITY_PROJECT_ID`, and `NEXT_PUBLIC_SANITY_DATASET` explicitly unset
(`env -u ...`) specifically to prove fixture mode has no live/network dependency.

### Read-only enforcement

The file must never contain the substrings `.patch(`, `.createOrReplace(`,
`.createIfNotExists(`, `.delete(`, `.mutate(`, `.transaction(`, or `.create(` —
enforced by grep in the contract (A4). This is a source-level invariant, not just a
runtime claim. If the implementation needs to describe what it deliberately does NOT
do in a comment, phrase it without the literal method-call syntax (e.g. "never
create-or-replace") so the comment itself doesn't trip the grep.

### Recursive walk

`walk(value, path)`:
- string → test against every pattern in the marker catalogue; each match is a hit
- array → recurse into each element, path suffix `[i]`
- plain object → recurse into every own-enumerable key, path suffix `.key`
- **no field is exempt**, including `_id`/`_type`/`_rev` — a duplicate-document bug
  could theoretically plant a sentinel there too

This must reach Portable Text bodies (`block` → `children[]` → `span.text`), not
just top-level scalar fields — the incident fields were top-level, but a
top-level-only scan gives false assurance for the next incident. Proven by
`fixture-dirty-nested.json`, whose ONLY residue is 4 levels deep
(`highlights[0].children[0].text`) while every top-level field is clean.

### Marker catalogue

See `marker-catalogue.md` in this directory — 9 patterns, each traced to the
specific mutating check file/line that writes it, derived by reading all mutating
checks, not guessed. Includes a correction: the original 16-file grep survey
undercounted (3 more files mutate via wrapper helpers a literal-string grep misses).

### Output format (exact — A9 asserts on this)

Each hit: `<docId> (<docType>) . <fieldPath> = <value>`

Example: `nationalShow (nationalShow) . highlights[0].children[0].text = Come
celebrate orchids in cultivation. F3-STAGES-SENTINEL-1786560879358`

Clean run: print a line containing `ALL CLEAR` (case-insensitive is fine) and the
document count scanned. Exit 0.

Dirty run: print every hit line, then a `FAIL:` summary line with the hit count.
Exit 1 (non-zero — any non-zero is acceptable, does not need to be exactly 1).

Missing credentials in live mode: print a line containing
`missing NEXT_PUBLIC_SANITY_PROJECT_ID` (the contract greps this exact substring)
and exit non-zero. This must be a **hard fail with a distinct, loud message**, never
a silent skip — a CI job that silently skips on missing creds recreates exactly the
"failure fires into a log no one reads" problem this scanner exists to fix. (Today
both `NEXT_PUBLIC_SANITY_PROJECT_ID` and `SANITY_API_TOKEN` ARE configured as GitHub
repo secrets — verified via `gh secret list` during contract authoring — so this path
should not fire in normal CI operation. It exists for the day someone rotates or
deletes a secret and needs the failure to be impossible to miss, same as the residue
it guards against.)

## CI wiring

`.github/workflows/ci.yml` gets a **new, separate job** (not a step inside the
existing `ci:` job), named `dataset-residue-guard`. Separate job, not a step,
because: (a) it needs `SANITY_API_TOKEN`, which the existing `ci:` job's header
comment explicitly documents as RUNTIME-only and deliberately excluded from the
build-availability env block — mixing it in would blur that documented boundary; (b)
a residue scan is conceptually independent of "does the app build," and keeping it
separate means a residue finding fails loudly under its own job name in the GitHub
Actions UI instead of being buried inside a `Build` step's log.

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

`NEXT_PUBLIC_SANITY_DATASET` is a plaintext literal (`production`), matching the
existing `ci:` job's own comment on why this one value is not read from a secret
(an empty-string secret previously broke every `sanityFetch` in CI silently — see
that job's env block).

### Secrets status (verified, not assumed)

`gh secret list` during contract authoring shows both `NEXT_PUBLIC_SANITY_PROJECT_ID`
and `SANITY_API_TOKEN` already exist as repo secrets (added 2026-06-28). **No new
secret needs to be created.** This job can hard-fail the build on any finding from
day one — there is no bootstrapping period where it should run in a non-blocking or
skip mode.

## Amendment (2026-08-16) — three QA-confirmed gaps closed, one open

QA ran the shipped scanner (F1) against reproducible fixtures and returned FAIL.
Three gaps were CRITICAL and reproducible; a fourth (case sensitivity) was MODERATE.
This amendment adds assertions and fixtures proving each — every one below was run
against the current scanner and CI workflow BEFORE this amendment and confirmed to
fail/pass exactly as described (i.e. the new assertions actually catch the shipped
defects, not just describe them).

1. **Portable Text span-split false negative (A8, CRITICAL).** `walk()` tests each
   string leaf independently, so a marker split across adjacent `children[]` spans of
   the same block — normal editing fallout from bold/link marks, not an exotic case —
   is invisible. `fixture-span-split-residue.json` splits
   `F3-TITLE-SENTINEL-1786560879358` across three spans such that no single span
   matches any of the 9 patterns; only the concatenated block text does. Confirmed:
   current scanner reports ALL CLEAR on this fixture. Fix must concatenate each
   block's span text and pattern-test the joined string IN ADDITION TO per-span
   testing (never instead of — a residue confined to one span, with siblings clean,
   must still be caught and still be reported without falsely implying the whole
   marker sat in one span).

2. **Non-string leaf false negative (A9, CRITICAL).** `walk()` only branches on
   `typeof value === 'string'`. `fixture-nonstring-leaf.json` has `countdownEpoch` as
   a genuine JSON number (`1786560879358`, not a quoted string). Confirmed: current
   scanner reports ALL CLEAR. Fix must coerce non-string primitive leaves through the
   same pattern tests — **numbers are required** (this is the reproduced gap).
   **Decision on booleans:** no pattern in the catalogue can match `"true"`/`"false"`,
   so coercing booleans is a documented no-op — not required, not tested, not a gap.
   **Decision on Date-like objects:** out of scope by construction, not by oversight —
   Sanity's HTTP API always serialises dates as ISO strings, never native `Date`
   instances, so a fetched document (live or fixture) cannot contain a Date object;
   the string-leaf path already covers every date value that can actually occur.

3. **No detection cadence (A10, CRITICAL, structural).** The CI job only triggers on
   `push`/`pull_request`. QA additionally confirmed via `gh api
   repos/InunuNet/SAOC/branches/main/protection` (404, "Branch not protected") that
   `main` has no branch protection, so a red job blocks nothing regardless — the
   2026-08-15 residue was written during a quiet stretch between PRs and sat for ~3
   days with no trigger to catch it. Fix: add a `schedule:` cron trigger to the
   top-level `on:` block of `.github/workflows/ci.yml` (daily is sufficient — this is
   a detection backstop, not a real-time monitor). A10 asserts the trigger exists via
   YAML-structural parse (not grep, so a `schedule:` string sitting in a comment can't
   fake a pass).

4. **Case sensitivity (A11, MODERATE).** SVI, EXH, F3, ZZCHECK, F6-LOOP-PROOF, and the
   SENTINEL catch-all patterns are case-sensitive while NOT-A-REAL-STATUS already
   carries `/i`. Confirmed: `f3-title-sentinel-test` (lowercase) slips through today.
   Fix: add `/i` to all six for consistency with the catalogue's stated "deliberately
   broad" intent. No currently-passing check depends on case sensitivity to avoid a
   false positive — this is pure defence in depth.

5. **A4 was weak (fixed in place, not new).** The original A4 grepped the scanner
   source for the 9 pattern-family names as substrings — a scanner that merely
   name-drops all 9 in a comment, with the actual regex catalogue silently missing
   one, would still pass. A4 now runs `fixture-all-patterns.json` (one document per
   pattern) through the scanner and requires exactly 9 hits and a non-zero exit —
   functional proof of detection, not textual proof of vocabulary. This passes
   against the current scanner today (the 9 regexes are in fact all present and
   correct) — it is a strengthening of a weak check, not a reproduction of a live bug,
   and is reported as such rather than being forced to show a false FAIL.

## Outstanding human action (not automatable, not dev work)

**Branch protection on `main` requiring the `dataset-residue-guard` (and `ci`) status
checks does not exist and must be enabled by Brad.** Do not attempt this as a code
change — it is a GitHub repository setting with no file representation in this repo.

- **UI (recommended, lowest risk of a malformed API payload):**
  `https://github.com/InunuNet/SAOC/settings/branches` → Add branch protection rule →
  branch name pattern `main` → enable "Require status checks to pass before merging"
  → select `ci` and `dataset-residue-guard` → Save.
- **Equivalent `gh` command**, for reference (a JSON file avoids `gh api`'s fragile
  nested-field flag syntax):
  ```
  cat > /tmp/branch-protection.json <<'JSON'
  {
    "required_status_checks": { "strict": true, "contexts": ["ci", "dataset-residue-guard"] },
    "enforce_admins": true,
    "required_pull_request_reviews": null,
    "restrictions": null
  }
  JSON
  gh api repos/InunuNet/SAOC/branches/main/protection -X PUT --input /tmp/branch-protection.json
  ```
- **Until this is done, every claim that a residue finding "blocks" anything is
  false.** The scanner and its CI job are real; they detect and report on a fixed
  cadence. They do not gate merges. Say exactly that, not "impossible to miss."

## Fixture-authoring rule: identifiers must never contain marker substrings (2026-08-16)

`fixture-all-patterns.json` originally used `_id: "doc-sentinel"` for the document
exercising the SENTINEL catch-all pattern (#8). Once A11 made that catch-all
case-insensitive, the literal substring `sentinel` inside the document's own `_id`
started matching too, pushing A4's expected hit count from 9 to 10 — a fixture
naming accident, not a scanner defect. The dev fix that shipped in response
(`STRUCTURAL_ID_FIELDS` exempting `_id`/`_type`/`_rev` from pattern matching in
`scripts/scan-dataset-residue.ts`) is backwards: it weakens real detection to
accommodate a test fixture's naming choice, and directly contradicts this file's own
"no field is exempt — including `_id`/`_type`/`_rev`" rule above. A sentinel
accidentally (or maliciously) planted in a real document's `_id` by a future check is
exactly the residue this guard exists to catch.

**Rule going forward: no fixture `_id` or `_type` in this directory may contain any
marker substring (`SENTINEL`, `SVI`, `EXH`, `F3`, `ZZCHECK`, `F6-LOOP-PROOF`, a
13-digit epoch run, `not-a-real-status`) in any case.** Exercise every pattern via a
field *value*, never via the identifier. The renamed fixture doc is now
`doc-catchall-case` — the SENTINEL catch-all coverage moved to the `a` field value
(`"leftover SENTINEL text"`), which was already carrying the actual marker; only the
`_id` changed. A12 (below) proves the underlying `_id`/`_type`/`_rev` non-exemption
directly, so this trade-off cannot resurface silently through a future fixture
rename.

## Rule: assertions and CI must invoke a shared script identically (2026-08-16)

Any contract assertion that exercises a script CI also runs must invoke that
script the SAME WAY CI does — same interpreter, same loader/runner flags, same
script path (differing only in what a genuine test-isolation wrapper adds, e.g.
`--fixture <path>` or an `env -u` credential-unset prefix). If the assertion's
invocation and CI's invocation are allowed to drift independently, a green
contract proves nothing about whether CI can actually run the thing.

**Why this rule exists:** on 2026-08-16 the `dataset-residue-guard` CI job ran
`node --import tsx/esm scripts/scan-dataset-residue.ts` and died on GitHub's
Node 22 runner with `ERR_REQUIRE_CYCLE_MODULE`. It worked locally on Node
26.4.0. This contract was 14/14 green throughout the incident — every assertion
(A1, A2, A4, A8, A9, A11-A14) invoked the same scanner and passed, because none
of them ran on the CI runner's Node version, and nothing checked that the
assertions' invocation even matched CI's. A10 only checked structurally that a
`schedule:`/`cron:` trigger existed — it said nothing about whether the command
the trigger runs actually works.

**A15** (added in this amendment) closes the half of this gap that is
checkable without a Node 22 runner: it parses both
`.github/workflows/ci.yml` and this contract's own assertions and fails if the
`dataset-residue-guard` job's invocation form ever diverges from every
assertion's invocation form (`contracts/checks/dataset-residue-guard/check_invocation_parity.py`).
It is a real, useful check — and it is also incomplete by construction. It
cannot and does not prove the matched invocation runs successfully on the CI
runner's Node version; that half of the 2026-08-16 incident (a Node-22-specific
module-loader behaviour that does not reproduce on Node 26.4.0) has no cheap
local equivalent. Do not describe A15 as "proving CI works" — describe it as
"proving the contract has actually exercised the same command CI runs," which
is a narrower, honest claim.
