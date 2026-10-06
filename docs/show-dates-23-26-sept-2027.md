# Show Dates Correction — 16–19 Sept 2027 → 23–26 Sept 2027

**Features:** F1–F3 of mission `show-dates-23-26-sept-2027` (milestone M1). Corrects every
current-fact reference to the National Show 2027 dates from Thu 16 – Sun 19 September to the
confirmed Thu 23 – Sun 26 September, in source-of-truth code, live Sanity documents, and docs.

**Mission brief:** `.agent/memory/project/specs/show-dates-23-26-sept-2027/contract-m1.yaml` and
its golden, `.agent/memory/project/specs/show-dates-23-26-sept-2027/goldens/m1-golden.md` — read
the golden first; it carries the full file-by-file classification and exact target values.
**This doc is the guide; that is the specification.**

**Status:** Gated (31/31 assertions pass — A31's two mid-mission amendments are recorded in the
golden, not left as open gaps), QA-passed (two rounds: F1+F2 together, then F3), Codex GPT-5.5
cross-model review run per standing project policy.

Precedent: `docs/f3-show-dates-purge-16-19-sept-2027.md` — the prior mission that moved these same
dates from 18–21 to 16–19 Sept. This mission repeats that shape at the next correction.

---

## Why This Correction Exists

Brad, 2026-10-06: "we had the NOS dates wrong again the actual dates are 23-26 September." The
National Show 2027 moves from Thu 16 – Sun 19 September to Thu 23 – Sun 26 September — the second
correction to these dates (the first moved 18–21 → 16–19; see the precedent doc).

## The governing rule: a uniform +7-day shift

16 → 23, 17 → 24, 18 → 25, 19 → 26 is exactly **+7 days** (one calendar week) on every day, which
is why Thursday stays Thursday and Sunday stays Sunday. Any value **derived** from the show start
by a fixed day-count therefore also shifts by exactly +7 days — but only a value that is actually
derived from the real show start. Every file was individually classified by what it actually
asserts (real show date vs. independent fact vs. arbitrary test input) before deciding whether the
shift applies at all; this was not a blind find-and-replace.

## What changed, and what's derived vs. independent

**Source-of-truth code literals (F1)** — the project-owned files that directly hold the show date:

| File | What moved |
|---|---|
| `lib/data/events.ts` | Event id 15's `date`/`endDate`: `'2027-09-23'`/`'2027-09-26'` |
| `lib/provisional-figures.ts` | `CONFIRMED_SHOW_START_2027 = new Date('2027-09-23T07:00:00Z')` |
| `lib/admission-early-bird-pricing.ts` | Comment only: "2027-09-23 start = 2027-06-25 cutoff" |
| `lib/hooks/useCountdown.ts` | Doc example instant |
| `lib/show-identity.ts` | schema.org bare-date example (line 79 only — see below) |
| `scripts/seed-show-visitor-info.ts` | `showDate`, `showEndDate`, two comments, FAQ answer text |
| `scripts/seed-page-singletons.ts` | `countdownDate` |

**DERIVED — recomputed by running the real engine, never by hand math:**

- **Admission early-bird cutoff.** `lib/provisional-figures.ts`'s `CONFIRMED_SHOW_START_2027` is
  the only edit; `deriveAdmissionEarlyBirdCutoffIso()` recomputes
  `VIP_EARLY_BIRD_CUTOFF`/`ADMISSION_PRODUCTS[vip].earlyBirdCutoff` automatically. The contract's
  A6/A7 prove this by actually importing and running the module
  (`node --import tsx/esm -e "import('./lib/provisional-figures.ts')..."`), not by grepping for the
  expected string — `deriveAdmissionEarlyBirdCutoffIso(new Date('2027-09-23T07:00:00Z'))` returns
  `'2027-06-25T00:00:00+02:00'` for real. The 90-day subtraction runs on SAST (`+02:00`) calendar
  components, not UTC ones — confirmed by both @qa passes using the early-morning-start
  discriminating case (`2027-09-23T01:00:00+02:00`, UTC date 22nd, SAST date 23rd) still deriving
  the correct cutoff.
- **Vendor-stand early-bird cutoff** (`lib/vendor-stand-pricing.ts`). Takes `showStartDate` as a
  caller-supplied parameter resolved from the live Sanity show window via
  `lib/show-window-lookup.ts` — **no code change at all**. Once F2 patched the live `show-19-2027`
  Sanity document, this recomputes automatically. The file holds no hardcoded show-date literal of
  its own (confirmed by grep before relying on this).

**Independent — left untouched on purpose:**

- `lib/provisional-figures.ts`'s legacy `EARLY_BIRD_CUTOFF = '2027-07-31'` is a separate,
  independently-sourced constant — its own comment says it is NOT derived from the show start.
  Moving it would have been a silent, incorrect scope expansion. A5 in the contract exists
  specifically to prove it stayed put.
- `lib/show-identity.ts:21`'s older "18–21 September 2027" example is a different, already
  out-of-scope placeholder from the *prior* purge — left untouched (A12 proves both the corrected
  line and this untouched line coexist, confirming scope discipline rather than an overzealous
  sweep).
- A set of test fixtures across `contracts/checks/ticketing-f4-admission-products/`,
  `ticketing-flow-redesign-f3/`, `cms-loop-f3-national-show/`, and
  `contracts/golden/dataset-residue-guard/` use arbitrary dates to exercise generic
  parsing/day-count logic unrelated to the real show date. See the golden's classification (c)
  for the full, individually-reasoned list.

**Dependent regression-check fixtures (F1, load-bearing):** three files in
`contracts/checks/ticketing-complete-f2/` each import the real `ADMISSION_PRODUCTS` and
independently recompute an expected cutoff from their **own** local `SHOW_START_DATE` constant to
compare against it. Once `CONFIRMED_SHOW_START_2027` moved, these local constants had to move with
it or the checks would go red for a reason unrelated to any real regression. All three were edited
and then actually run (not just grepped) to confirm they still PASS.

## The Sanity patch script and its `--verify` mode

`scripts/fix-show-dates-23-26-sept-2027.ts` — new, following the convention of the precedent
script `scripts/fix-show-dates-2027.ts`: reads `.env.local` directly (never hardcodes a token),
`.set()` not `.setIfMissing()` (the fields are already populated with stale values), `--dry-run`
support, idempotent (`.set()` unconditionally — a second run writes the identical already-correct
value with no drift, proven by re-running it live immediately after the first apply).

Four documents, one more than the precedent (the precedent moved three):

- `nationalShow` (`_id: "nationalShow"`) — `showDate`, `showEndDate`, `countdownDate`
- `show-19-2027` (`_id: "show-19-2027"`, `_type: "show"`) — `startDate`, `endDate`
- `societyEvent-15-19th-south-african-national-orchid-show` — `date`, `endDate`
- **New this mission:** the "When is the show?" FAQ answer. Its `_id` was ambiguous in this
  repo's own records (TS seed source uses `'showFaq-general-3'`; a historical golden quotes the
  live `_id` with dots instead of dashes). Rather than guess, the script resolves it live via
  `*[_type == "showFaq" && question == "When is the show?"][0]._id` and patches whatever that
  query returns — which resolved to `showFaq-general-3` in production.

`--verify` queries production directly and exits non-zero on any mismatch — this is the real
proof the gate's A25 depends on, not a proxy on script source. It only passes once the script has
actually been run for real (not `--dry-run`) against production. Per-document before → after
values and the full idempotency re-run are recorded in
`.agent/memory/scratch/dev-result-show-dates-f2.md`.

The deployed check (A26) hit a stale ISR cache on its first attempt against beta.saoc.co.za and
passed on a retry after the home page revalidated (~70s) — not a defect, the expected ISR
propagation delay after a live Sanity patch.

## Why historical records were left verbatim

The project's standing rule (established by the precedent mission's A20, repeated here) is: never
rewrite incident history to make it agree with today's facts. Several docs narrate a **past,
dated decision** — "on 2026-09-08, VIP's cutoff was set to the then-correct 2027-06-18" — in the
past tense. Rewriting the number would falsify the record of what was actually decided that day.
Left untouched: `docs/ticketing-complete-f1.md`, `-f2-open-decisions.md`, `-f8.md`,
`-f8-morning-review.md`, `docs/f1-ticketing-pricing-migration.md`, `docs/b4-national-show.md`,
`docs/f3-show-dates-purge-16-19-sept-2027.md` (the entire prior-purge record), and
`README.md`'s changelog line for that mission.

**The `_comment` restore in `f1-pricing-boundary-cases.json`.** This fixture's root `_comment`
field holds two logically distinct claims: a current-fact restatement of the live show start
(correctly shifted to 2027-09-23/2027-06-25) and a historical narrative — "corrected 2026-09-08
(team lead) from an earlier version of this fixture that used `2027-09-16T00:00:00Z`." Dev's first
pass over this file pattern-matched the whole string, including the historical clause, and
rewrote it to `2027-09-23T00:00:00Z` — which is false: on 2026-09-08 the show wasn't scheduled for
the 23rd at all, so no earlier buggy fixture version could ever have held that instant. QA caught
this (`.agent/memory/scratch/qa-report-show-dates-f1-f2.md` §1) and it was restored to
`2027-09-16T00:00:00Z` in F3. Root cause: A19's original residue sub-check was a blanket
whole-file substring grep, which made "satisfy A19" and "preserve this one historical clause"
mutually exclusive. The fix was to narrow A19 (contract amendment #1, 2026-10-06) to a real JSON
parse of only the structural fields (`showStartDateIso`, `expectedCutoffIso`,
`cases[].purchaseDateIso`, `cutoffDerivationCases[]`) — prose fields like `_comment` are no longer
inspected by that check at all, so the two concerns stop colliding. The correct pattern for this
situation — demonstrated elsewhere in the same mission — is append, not rewrite: F1's edit to
`contracts/golden/f4-seed-page-singletons/nationalShow.golden.json`'s `note` field left every
prior historical sentence verbatim and appended a new "AMENDED AGAIN by the
show-dates-23-26-sept-2027 mission" clause stating the current value.

## The A31 residue-scan allowlist, and the zsh-vs-bash glob trap

A31 is a full-tree grep for `2027-09-1[6-9]` and `2027-06-18` across checked-in source and docs,
excluding a long, individually-justified allowlist (see the golden's "Residue scan" section for
every entry and the reasoning behind it — not a blanket exemption). Two amendments landed
mid-mission, both recorded in `contract-m1.yaml` and the golden rather than quietly absorbed:

1. **Unquoted `--include=*.ext` globs are a shell-dependent bug.** In zsh (this project's
   documented interactive shell), an unquoted glob is expanded by the shell before grep ever sees
   it; with no literal file named `*.ts` in cwd, this can empty the captured output and make
   `test -z "$(...)"` falsely report PASS regardless of real residue. QA confirmed
   `execution/contract.py` runs assertion commands under `bash`, not zsh, so the real gate was
   never actually exposed to this specific failure — but quoting every `--include` argument
   removes the shell-dependence entirely rather than relying on which shell happens to run it.
2. **Allowlist gaps found by running the command for real, under both shells.** Six legitimate
   exclusions were missing: two gitignored scratch directories (`.agent/memory/scratch/`,
   `.tmp/`), golden companions of already-excluded check directories, illustrative anti-pattern
   comments (excluded by content match, not line number, so the exclusion survives future
   line-shifts), a tracked-but-scratch-named render helper, and
   `design/design_handoff_saoc/README.md` (Brad's active design handoff — off-limits to edit
   regardless of content; see the NOS Site lane notice below for the parallel case).

Dev's own F3 run then found a second, real FAIL under `bash -c` (amendment #2) — 6 further hits,
all historical narrative or a pre-existing wrapping miss, none current-fact residue. Dev correctly
left all 6 untouched rather than guess-edit them, and reported the gap rather than silently
widening the allowlist. The architect verified each by reading the file directly and added six
content-matched excludes. The architect's own re-run included a negative control: a synthetic
file under `.tmp/sandbox/` with a fabricated `2027-09-16`/`2027-09-19` line was run through the
identical filter chain and survived every exclusion (non-zero output) — proving the new excludes
are narrow enough that unrelated residue still gets caught, not that the allowlist had grown wide
enough to hide anything. QA's own F3 pass repeated this proof independently with four more
synthetic probes (three survived the filter as expected, only the one deliberately
whole-file-excluded design doc was suppressed).

## The NOS Site lane notice

`app/(marketing)/national-show/**` belongs to the NOS Site session (branch `origin/nos-site`), not
this project's working tree. F3 checked that branch's `app/` tree directly via
`git grep` for the old date pattern — zero hits, nothing there hardcodes the old dates today — and
still appended a notice to the root `comms.md` (append-only, this project's own block; see
`.claude/rules/comms.md`), because that session's pages likely render the same shared `nationalShow`
Sanity document this mission's F2 patched, and its own markdown/copy sources outside `app/` were
never scanned by this mission.

## Known gaps

- **`design/design_handoff_saoc/README.md`** still says "Countdown target: 2027-09-16T09:00+02:00"
  (lines 141, 200) and references the show dates at the old value. This is Brad's active,
  approved design handoff (project memory `project_design_folders_brad_active`) — off-limits to
  edit without his say regardless of which date is correct. Flagged for Brad, not fixed by this
  mission.
- **`docs/f5-day-selection-attendees.md:29`** — the UTC+2 explanation here was already factually
  wrong before this mission (Codex finding, carried forward unfixed by this mission since it was
  out of scope): the doc claims that without the `+02:00` offset, `.getUTCDate()` on a date string
  like `'2027-09-23T00:00:00Z'` would derive "2027-09-22." It would not — `getUTCDate()` of a
  midnight-UTC instant returns the same calendar day, so this specific example never demonstrated
  the bug it claims to illustrate. This mission only shifted the date tokens inside the existing
  (incorrect) example +7 days; the underlying reasoning was not corrected, because fixing the
  argument itself was never this mission's scope.
- **A26's single stale-cache miss.** The gate's A26 deployed check failed once and then passed on
  an immediate re-run and 6 consecutive follow-up probes during QA. Most likely a single-instance
  stale ISR render on Firebase App Hosting shortly after the live Sanity patch — unconfirmed, not
  reproduced on demand.
- **`docs/b4-national-show.md:57`** describes a `const TARGET_MS = ...` literal in
  `components/show/ShowCountdown.tsx` that no longer exists — the real component now reads
  `countdownDate` dynamically. This doc is stale for a different, pre-existing reason (describes
  dead code, unrelated to which date is correct) and was not fixed by this mission; same
  out-of-scope treatment the precedent doc gave it.

## Contract & Golden Files

See `.agent/memory/project/specs/show-dates-23-26-sept-2027/`:
- `contract-m1.yaml` — 31 gate assertions across F1 (source literals + dependent/companion
  fixtures + TypeScript), F2 (new Sanity patch script + live verify + deployed check), F3 (docs
  sweep + full-tree residue scan + NOS Site lane notice).
- `goldens/m1-golden.md` — the full file-by-file classification, exact target values, the two A31
  amendments, and the F2 script's constants.
- Contract Status: 31/31 pass.
