# firestore-residue-guard — golden reference

## Why this exists

The 2026-08-15 incident (`contracts/golden/dataset-residue-guard/README.md`) closed
the Sanity half of this risk: a contract check writes sentinels into a LIVE dataset
to prove a round trip, and its cleanup can half-fail. That guard's contract
explicitly scoped Firestore OUT. The same class of risk exists in Firestore and is
today completely unguarded:

- `contracts/checks/ticketing-hardening/_shared.mjs` writes sentinel tickets
  (`SENTINEL_EMAIL_DOMAIN`, `HARDEN-` booking refs, `'Harden Check'`/`'Harden
  Filler'` names) directly into the live `tickets` collection, protected only by
  `withCleanup()`'s `sweepSentinels()` + `assertNoResidue()` — the exact same class
  of "cleanup is the only line of defence" this whole guard family exists to
  backstop.
- `contracts/checks/m2-next16-upgrade/check-routes.mjs` POSTs a real ITN with a
  `m2-check-itn-<epoch>-<rand>` probe id into `m_payment_id`.
- Four real `tickets` documents and two `contactSubmissions` documents are sitting
  in the live database RIGHT NOW from manual PayFast diagnostic probing on
  2026-08-12 (not from an automated check at all — see marker-catalogue.md). This
  guard's first live run is expected to report them. **That is correct behaviour,
  not a bug in the scanner** — see "Known findings" below. This contract does not
  delete them; deletion is Brad's call.

**Countermeasure:** `scripts/scan-firestore-residue.ts`, an always-on, read-only,
recursive scanner mirroring `scripts/scan-dataset-residue.ts`'s proven design,
wired into CI as its own job.

> **Delivery status — read before trusting this guard.** What ships from this
> contract is the scanner (F1) and a CI job (F2) that runs it **only when Firebase
> Admin credentials exist as repo secrets** — they do not today (verified via `gh
> secret list` on 2026-08-16: only `NEXT_PUBLIC_SANITY_PROJECT_ID` and
> `SANITY_API_TOKEN` exist; no `FIREBASE_ADMIN_*` secret is configured). Until
> Brad adds `FIREBASE_ADMIN_PROJECT_ID` / `FIREBASE_ADMIN_CLIENT_EMAIL` /
> `FIREBASE_ADMIN_PRIVATE_KEY` as repo secrets, the CI job's scan step is
> **visibly skipped** (grey, not green) with an explicit `::warning::` annotation
> — never silently green, never a hard failure on every run either. Fixture-mode
> detection is real and gate-proven regardless of CI secrets. Also, like the
> sibling guard: `main` has no branch protection, so even once secrets are added,
> a red `firestore-residue-guard` job blocks nothing by itself — advisory only
> until a human enables branch protection. Do not describe this guard as
> "impossible to miss" until both gaps (missing secrets, no branch protection)
> are closed.

## Scanner design (binding on `scripts/scan-firestore-residue.ts`)

### Two run modes

- **Live mode** (default, no flags): Firebase Admin SDK, credentials read
  directly from `.env.local` the same way `scripts/admin-grant.ts` and
  `scripts/scan-dataset-residue.ts` do it — **no `dotenv` package** (its startup
  banner has corrupted an env value on this project before; see
  `scripts/seed-page-singletons.ts`'s header comment). Required vars:
  `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`,
  `FIREBASE_ADMIN_PRIVATE_KEY` (with `.replace(/\\n/g, '\n')` on the key, same as
  every other admin script in this repo). Missing any of them is a **loud, hard
  fail** — print a line containing `missing FIREBASE_ADMIN_PROJECT_ID` (or
  whichever var), exit non-zero. Never a silent skip inside the script itself —
  the CI job's skip-when-absent behaviour (below) is a CI-level decision, made
  once, visibly, not something the script itself should paper over.
- **Fixture mode** (`--fixture <path>`): reads a local JSON array of
  `{ "collection": string, "id": string, "data": object }` records. No Firebase
  Admin app is ever initialized in this mode, no credential is read, no network
  call is made. This is what every contract assertion except A5/A6/A11/A14 runs
  against, with `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, and
  `FIREBASE_ADMIN_PRIVATE_KEY` explicitly unset (`env -u ...`) to prove it.

Why a live database write-based test is never used to prove detection: the live
Firestore database must stay clean (once the two known findings below are
resolved by Brad). A test that proves detection by writing a sentinel to the
live database recreates the exact bug this guard exists to catch. Same
reasoning as the Sanity guard, same rule (hard requirement #2 from the
architecture brief).

### Dynamic collection enumeration

Live mode MUST discover collections via the Admin SDK's root-level
`db.listCollections()` (an async iterable/array of `CollectionReference`), never
a hardcoded array like `['tickets', 'contactSubmissions']`. A new collection
added later (e.g. a future `waitlist` or `sponsorEnquiries`) must be scanned
automatically, with no code change. Enforced structurally by A8 (grep for
`listCollections` in the scanner source — this is a source-level architectural
invariant, like the read-only enforcement in A3, not a runtime behaviour claim,
so grep is appropriate here per the same reasoning the Sanity guard's own
README gives for its read-only grep).

Known collections at authoring time, for fixture design only (NOT a hardcoded
scan list): `tickets`, `contactSubmissions`, `societies`, `events`,
`nationalShows` (see root `CLAUDE.md`, "Collections" table). Only `tickets` and
`contactSubmissions` currently have a mutating check or manual-probe history;
`societies`/`events`/`nationalShows` are documented as hand-added via Firestore
console, no code path writes test data into them today — they are still scanned
(no field is exempt from `db.listCollections()`'s discovery), just not expected
to ever produce a hit.

### Recursive walk

Reuses the exact same `walk(value, path)` shape as `scripts/scan-dataset-residue.ts`:
- string → test against every regex pattern AND the literal known-residue-ID
  list; each match is a hit
- number → coerce via `String(value)`, test the same way (closes the Sanity
  guard's QA gap #2 on day one instead of after an incident)
- array → recurse into each element, path suffix `[i]`
- plain object (including nested Firestore maps) → recurse into every
  own-enumerable key, path suffix `.key`
- **no field is exempt**, including `id` (the Firestore document ID, passed
  alongside `data` — analogous to Sanity's `_id` non-exemption, same reasoning:
  a duplicate-document bug could plant a sentinel in a doc ID as easily as in a
  field)

**No Portable Text span-joining logic is needed or should be built.** Firestore
has no rich-text/mark-based storage model comparable to Sanity's Portable Text
— a Firestore string field is never edited by a mark-boundary-aware rich text
editor that could split a marker mid-value across sibling nodes. This was
considered and deliberately rejected, not overlooked; do not port that part of
the Sanity scanner's design.

### Firestore-native value types (Timestamp / GeoPoint / DocumentReference)

Live-mode documents from the Admin SDK can contain `Timestamp`, `GeoPoint`, and
`DocumentReference` instances — none of which are plain JSON and none of which
survive `Object.entries()` recursion meaningfully (a `Timestamp` instance's
`_seconds`/`_nanoseconds` are not own-enumerable; a naive walk silently skips
it, an exact repeat of the Sanity guard's QA gap #2 in a new shape). Export a
`toPlainValue(value): unknown` normalizer from the scanner module and run every
live document's `data` through it (deep, recursive) before calling `walk()`:
- `value` with a `toDate` function (Timestamp) → `value.toDate().toISOString()`
- `value` with numeric `latitude`/`longitude` properties and no `toDate`
  (GeoPoint) → `` `${value.latitude},${value.longitude}` ``
- `value` with a string `path` property and a `firestore`/`parent` property
  (DocumentReference, duck-typed — do not import the class for the check) →
  `value.path`
- everything else → returned unchanged (plain objects/arrays/primitives fall
  through to the ordinary `walk()` recursion)

This function must be **exported** (not a private closure) specifically so
`contracts/checks/firestore-residue-guard/check_special_value_normalization.mjs`
can import and unit-test it directly against duck-typed fake Timestamp/GeoPoint/
DocumentReference objects — a JSON fixture file structurally cannot represent
these types (JSON has no function values, so a `{toDate: fn}` shape cannot
round-trip through `--fixture`), so this is the one piece of scanner behaviour
this contract cannot exercise through the fixture-file mechanism used
everywhere else. This mirrors the Sanity guard's own precedent for "some gaps
can only be closed by testing the right layer" (its A15 invocation-parity
check exists for the same kind of reason — some correctness properties aren't
reachable by output-comparison alone).

### Read-only enforcement

The scanner source must never contain `.set(`, `.update(`, `.delete(`,
`.add(`, `.create(`, `.batch(`, or `.runTransaction(` — enforced by grep (A3).
If the implementation needs to describe in a comment what it deliberately does
NOT do, phrase it without the literal method-call syntax so the comment itself
doesn't trip the grep (same rule as the Sanity guard).

### Output format (exact — A1/A9/A10 assert on this)

Each hit: `<collection>/<docId> . <fieldPath> = <value>`

Example: `tickets/abc123 . attendeeEmail = filler-a-3@harden-check.invalid`

Clean run: a line containing `ALL CLEAR` (case-insensitive) plus the document
count scanned. Exit 0.

Dirty run: every hit line, then a `FAIL:` summary line with the hit count.
Exit non-zero (any non-zero is acceptable).

Missing credentials in live mode: a line containing `missing
FIREBASE_ADMIN_PROJECT_ID` (or whichever var is first missing), loud, distinct,
never a silent skip inside the script. Exit non-zero.

## CI wiring

`.github/workflows/ci.yml` gets a **new, separate job**, `firestore-residue-guard`
— same reasoning as the Sanity guard's own job (RUNTIME-only secrets kept out of
the build-availability env block; a residue finding fails loudly under its own
job name instead of being buried in a `Build` step).

```yaml
  firestore-residue-guard:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Check Firestore admin secrets are configured
        id: creds
        run: |
          if [ -n "${{ secrets.FIREBASE_ADMIN_PROJECT_ID }}" ]; then
            echo "present=true" >> "$GITHUB_OUTPUT"
          else
            echo "present=false" >> "$GITHUB_OUTPUT"
          fi
      - name: Scan live Firestore for test residue
        if: steps.creds.outputs.present == 'true'
        env:
          FIREBASE_ADMIN_PROJECT_ID: ${{ secrets.FIREBASE_ADMIN_PROJECT_ID }}
          FIREBASE_ADMIN_CLIENT_EMAIL: ${{ secrets.FIREBASE_ADMIN_CLIENT_EMAIL }}
          FIREBASE_ADMIN_PRIVATE_KEY: ${{ secrets.FIREBASE_ADMIN_PRIVATE_KEY }}
        run: pnpm exec tsx scripts/scan-firestore-residue.ts
      - name: No Firestore admin secrets — scan not run
        if: steps.creds.outputs.present == 'false'
        run: |
          echo "::warning::firestore-residue-guard SKIPPED — FIREBASE_ADMIN_PROJECT_ID/_CLIENT_EMAIL/_PRIVATE_KEY are not configured as repo secrets (verified via 'gh secret list' 2026-08-16). This is NOT a clean scan result. Add these three secrets to enable live Firestore residue detection in CI. See contracts/golden/firestore-residue-guard/README.md."
```

Invocation form pinned by A14, mirroring the Sanity guard's A15: `pnpm exec tsx
scripts/scan-firestore-residue.ts`. **Do not use `node --import tsx/esm`** — that
form is what broke the sibling guard's CI job on GitHub's Node 22
(`ERR_REQUIRE_CYCLE_MODULE`) while staying green locally; this is now a standing
rule (see `contracts/golden/dataset-residue-guard/README.md`), not a fresh
decision to relitigate here.

**Cadence:** the top-level `on:` block needs a `schedule:`/`cron:` trigger, same
justification as the Sanity guard's A10 (no branch protection on `main`, so a
red job on a PR blocks nothing and residue written outside a PR is invisible
until someone happens to open one). A14/A11 only require that a `schedule:`
trigger with `cron:` exists somewhere in `on:` — if the concurrently-edited
`dataset-residue-guard` contract has already added one, this is satisfied for
free; if not, dev must add it. **Coordination risk:** `.github/workflows/ci.yml`
is being edited by another in-flight agent (`contract-dataset-residue-guard.yaml`)
at the same time as this contract's F2. Dev must re-read the file immediately
before editing, add the `firestore-residue-guard` job additively (new job key,
do not touch the `dataset-residue-guard` job or any existing `on:` triggers),
and re-run A6/A11/A14 after any rebase.

### Secrets status (verified, not assumed)

`gh secret list` on 2026-08-16 shows exactly two repo secrets:
`NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN` (both added 2026-06-28). **No
`FIREBASE_ADMIN_*` secret exists.** This is why the CI job above is written to
skip visibly rather than fail on every run (hard requirement #6 from the
architecture brief) — a job that is red on every single push trains everyone to
ignore it, which recreates exactly the "failure fires into a log no one reads"
problem this guard exists to fix. Adding the three `FIREBASE_ADMIN_*` secrets
(same three values already in `.env.local`, per
`.agent/memory/project/notes/reference_saoc_credentials_inventory.md`-style
inventory — check `.env.local` before asking Brad for anything) is an
**outstanding human action**, not dev work this contract can complete.

## Known findings awaiting Brad's decision (do NOT delete — report only)

- `tickets/*` — four documents, still `reserved`, booking refs
  `SAOC-2027-E8WND2SM4HTD`, `SAOC-2027-JG6Q598FG0QD`, `SAOC-2027-5H63FBAE8AHP`,
  `SAOC-2027-C584G82Z7F6D` — real sandbox checkout residue from 2026-08-12
  manual PayFast diagnostic testing. Will be reported by the live scan once
  Firebase Admin secrets are added to CI, or can be found today by running the
  scanner locally against `.env.local`'s existing credentials.
- `contactSubmissions/*` — two diagnostic documents from the same session, no
  distinguishing marker recorded (see marker-catalogue.md's "Explicitly NOT
  pattern-detectable" section) — this scanner cannot find these on its own;
  they must be located by hand in the Firestore console.
- Deletion of any of the above is explicitly **out of scope** for this
  contract — it is destructive and is Brad's call (per the architecture brief
  and `.agent/memory/project/backlog.md`'s own P3 item for this cleanup).

## Follow-up backlog candidates (not this contract's scope)

- A Firebase-Auth-user residue guard for `ADMIN_TEST_UID`/`ADMIN_TEST_EMAIL`
  (see marker-catalogue.md's "Auth-only markers" section) — a distinct tool,
  Auth is not Firestore.
- Once `FIREBASE_ADMIN_*` secrets exist and this guard has run clean at least
  once, revisit whether `main` branch protection should require this check
  (same open item as the Sanity guard).
## Credential-path coverage is not optional (2026-08-16)

Every fixture-mode assertion in this contract runs with `FIREBASE_ADMIN_PROJECT_ID`,
`FIREBASE_ADMIN_CLIENT_EMAIL`, and `FIREBASE_ADMIN_PRIVATE_KEY` explicitly unset, and
fixture mode reads no `.env.local` by design. That means, before A15, nothing in this
gate ever called `readEnvLocal()` — the one function in this scanner that ever touches
a real credential — even though the project has four prior secret-corruption
incidents. QA found a CRITICAL bug there: under CRLF line endings, the multi-line
quoted-value continuation loop compared the raw (untrimmed) line against the closing
quote character, so a line like `-----END PRIVATE KEY-----"` (with a trailing `\r`)
never matched, and the parser silently absorbed the rest of the file into the
credential value while dropping every variable declared after it.

**General rule: any code path that reads credentials must have gate coverage.**
Fixture-mode (or any mode that substitutes a stand-in for the real input) assertions
structurally cannot reach a code path that only runs on the real input — a green gate
built entirely out of such assertions proves the surrounding logic, not the credential
parser sitting next to it. This is the same shape as the CI-invocation-parity gap A14
guards against elsewhere in this same contract: an assertion that exercises a
different path from the one that runs for real proves nothing about the real one. When
a function like this exists specifically to protect a sensitive input, it needs its
own direct test (A15 imports `readEnvLocal()` and drives it with a CRLF fixture built
from real `\r\n` bytes), not just indirect coverage through code that happens to call it.
