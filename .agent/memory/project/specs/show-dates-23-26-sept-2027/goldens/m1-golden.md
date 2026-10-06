# M1 Golden — show-dates-23-26-sept-2027

Brad, 2026-10-06: "we had the NOS dates wrong again the actual dates are 23-26 September"
(2027 implied). **Old:** Thu 16 – Sun 19 September 2027. **New:** Thu 23 – Sun 26 September 2027.

## The governing rule: it's a uniform +7-day shift

16 → 23, 17 → 24, 18 → 25, 19 → 26 is exactly **+7 days** (one calendar week) on every day,
which is why Thu stays Thu and Sun stays Sun. Any value *derived* from the show start by a fixed
day-count (the 90-day admission/vendor-stand early-bird cutoffs) therefore *also* shifts by
exactly +7 days: old cutoff 2027-06-18 → new cutoff **2027-06-25** (18 → 25, same rule).
`deriveAdmissionEarlyBirdCutoffIso(new Date('2027-09-23T07:00:00Z'))` must be **run for real** and
must return `'2027-06-25T00:00:00+02:00'` — this is stated here as the expected value to check
the real engine against, not as a hand-derived substitute for running it.

This mechanical rule is a convenience for applying the edits, **not** a licence to pattern-match
blindly: every file below was individually classified by what it actually asserts (real show
date vs. independent fact vs. arbitrary test input) before deciding whether the +7 shift applies
to it at all. Don't shift a date that doesn't represent the real show.

## Classification

**(a) Project-owned, MUST change — load-bearing (breaks or goes false without the edit):**

| File | Line(s) | Old → New |
|---|---|---|
| `lib/data/events.ts` | 171–172 | `date:'2027-09-16'` → `'2027-09-23'`; `endDate:'2027-09-19'` → `'2027-09-26'` |
| `lib/provisional-figures.ts` | 86 (+comment 78) | `CONFIRMED_SHOW_START_2027 = new Date('2027-09-16T07:00:00Z')` → `new Date('2027-09-23T07:00:00Z')` — `VIP_EARLY_BIRD_CUTOFF` recomputes automatically, do not hand-edit it |
| `lib/admission-early-bird-pricing.ts` | 27 | comment only: "2027-09-16 start = 2027-06-18 cutoff" → "2027-09-23 start = 2027-06-25 cutoff" |
| `lib/hooks/useCountdown.ts` | 88 | doc example `2027-09-16T09:00:00+02:00` → `2027-09-23T09:00:00+02:00` |
| `lib/show-identity.ts` | 79 only | `2027-09-16` → `2027-09-23`. **Leave line 21 untouched** (its even-older "18–21 September 2027" example is out of scope by established precedent — confirms scope discipline, same as the prior purge's A9) |
| `scripts/seed-show-visitor-info.ts` | 124 (comment), 128 `showDate`, 129 `showEndDate`, 208 (comment), 451 (FAQ answer text) | shift +7: `'2027-09-16T09:00:00+02:00'`→`'2027-09-23T09:00:00+02:00'`, `'2027-09-19T17:00:00+02:00'`→`'2027-09-26T17:00:00+02:00'`, `'Thursday 16 to Sunday 19 September 2027...'`→`'Thursday 23 to Sunday 26 September 2027...'` |
| `scripts/seed-page-singletons.ts` | 216 | `countdownDate:'2027-09-16T09:00:00+02:00'` → `'2027-09-23T09:00:00+02:00'` |
| `contracts/checks/ticketing-complete-f2/check-vip-computed-early-bird-price.mjs` | 39, 43, 44 (+comments 14,16) | `SHOW_START_DATE`→`2027-09-23T07:00:00Z`; `INSIDE_WINDOW_PURCHASE_DATE`→`'2027-06-25T00:00:00+02:00'`; `OUTSIDE_WINDOW_PURCHASE_DATE`→`'2027-06-26T08:00:00+02:00'`. **Why this one is load-bearing, not cosmetic:** this file imports the REAL `ADMISSION_PRODUCTS` from `lib/provisional-figures.ts` and independently recomputes an expected cutoff from its OWN local `SHOW_START_DATE` to compare against it. Once `CONFIRMED_SHOW_START_2027` moves, this file's local constant must move with it or the check goes red for a reason that has nothing to do with a real regression. |
| `contracts/checks/ticketing-complete-f2/check-vip-stored-cutoff-derived.mjs` | 40 (+comments 6,72,93) | same `SHOW_START_DATE` update, same reason |
| `contracts/checks/ticketing-complete-f2/check-vip-migration-plan-cutoff.mjs` | 40 (+comment 86) | same `SHOW_START_DATE` update, same reason |

After these edits, run all three `ticketing-complete-f2` check files directly — they must PASS
(not just "not reference the old date").

**(b) DERIVED — recompute via the function, never by hand:**

- Admission early-bird cutoff: `deriveAdmissionEarlyBirdCutoffIso(showStart)` → `2027-06-25T00:00:00+02:00`. Flows automatically from (a)'s `lib/provisional-figures.ts` edit.
- Vendor-stand early-bird cutoff (`lib/vendor-stand-pricing.ts`): takes `showStartDate` as a caller-supplied parameter (resolved from the live Sanity show window via `lib/show-window-lookup.ts`) — **no code change needed here at all**. Once F2 patches the live Sanity document, this recomputes automatically. Confirmed: this file contains no hardcoded show-date literal of its own.

**(c) Independent / arbitrary fixture — LEAVE untouched, flagged (no Brad ruling needed, already settled or genuinely irrelevant to which date):**

- `lib/provisional-figures.ts:71` `EARLY_BIRD_CUTOFF = '2027-07-31'` — independently-sourced legacy constant, explicitly NOT derived from show start (own comment says so). Untouched.
- `contracts/checks/ticketing-f4-admission-products/check-early-bird-window.mjs:76`, `contracts/checks/ticketing-flow-redesign-f3/*.mjs` (`MON`/`WED` constants), `contracts/checks/cms-loop-f3-national-show/*.mjs` + `_shared.mjs`, `contracts/golden/dataset-residue-guard/fixture-{clean,dirty-nested}.json` — all arbitrary test dates exercising generic parsing/validation/day-count logic, not asserting the real show date.
- `contracts/checks/vendor-gated-registration-flow/check-application-approval-email-copy.mjs:90,108` (`loadOutSlot: '2027-09-19T18:00'`) — a free-text field a vendor types themselves (`lib/vendor-register-form-payload.ts`); this is sample test input, not a system constant. Confirmed via grep: no production code derives `loadOutSlot` from the show window.
- `contracts/golden/f5-event-slugs/expected-slugs.golden.json:23` — self-exempted by its own `dateFieldExemption` note ("display/documentation only"). Untouched.
- `contracts/golden/venue-never-changed-copy-fix-f1/corrected-fields.golden.md:97,105` — the checked script (`check_golden_json.py`) only diffs 6 non-date prose fields (`researchLabel`, `planIntro`, `gettingThereIntro`, `parking`, `accommodationIntro`, `accessibility`); the date-bearing lines are frozen illustrative context, not gated. Untouched.
- `contracts/checks/ticketing-f5-day-attendees/check-no-placeholder-dates.sh` + its golden README — this is a **self-referential anti-contamination guard** for that feature's own fixtures only (fails if any fixture in `contracts/checks/ticketing-f5-day-attendees/` reuses the real placeholder range instead of a synthetic 2099-* date). It does not assert the real show date and needs no change.
- `e2e/mega-menu-f8-logo-and-tickets-rail.spec.ts:348` — comment-only historical bug note. Untouched.
- `docs/nos-design-system.md:283` — describes the NOS site's own data shape; NOS-lane-adjacent, left to that session.

**(c′) Truthfulness-only, not gate-breaking — update for hygiene, include in F1 since mechanical and cheap:**

These are self-contained pure-function test fixtures (their expected outputs are computed from
their OWN embedded input dates, not compared against this project's live production constants),
so leaving them stale would NOT turn any check red. They are included anyway because their own
comments explicitly claim to mirror the real show date, and a fixture that claims to mirror real
data while silently drifting from it is this project's own named defect class.

- `.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f1-pricing-boundary-cases.json` — shift **every** date by +7 days: root `showStartDateIso` (`2027-09-16T07:00:00Z`→`2027-09-23T07:00:00Z`) and `expectedCutoffIso` (`2027-06-18T00:00:00+02:00`→`2027-06-25T00:00:00+02:00`); all 7 `cases[].purchaseDateIso` values (`2027-06-17`→`06-24`, `2027-06-18`→`06-25` ×2, `2027-06-19`→`06-26`, the UTC-disagreement case `2027-06-18T23:00:00Z`→`2027-06-25T23:00:00Z`, the rounding case `2027-06-17...`→`06-24...`, and `2027-08-01...`→`2027-08-08...` for uniformity); both `cutoffDerivationCases[]` entries' `showStartDateIso`/`expectedCutoffIso` (including the early-morning-start discriminating case, `2027-09-16T01:00:00+02:00`→`2027-09-23T01:00:00+02:00`). Update the embedded prose in `boundarySweepVerdict`/case `note` fields to match. After editing, run `contracts/checks/ticketing-complete-f1/check-pricing-boundaries.mjs` and `check-cutoff-derivation.mjs` directly — both must still PASS (they were passing before too; this proves the edit didn't break the self-contained arithmetic).

  **F3 work item — restore ONE historical substring in `_comment` (QA finding, 2026-10-06, see `.agent/memory/scratch/qa-report-show-dates-f1-f2.md` §1; NOT done by the architect — this is dev's edit to make):** the root `_comment` field narrates a *2026-09-08* historical correction: "...corrected 2026-09-08 (team lead) from an earlier version of this fixture that used **`2027-09-16T00:00:00Z`**, a DIFFERENT instant that happened to produce the same cutoff...". That clause describes what the fixture's *earlier, pre-2026-09-08* version actually contained — a fact about history, fixed forever regardless of what today's mission does to the live fields above it. The current working tree has this wrongly shifted to `2027-09-23T00:00:00Z` (dev pattern-matched the whole file including this prose), which falsifies the record: on 2026-09-08 the earlier version used `2027-09-16T00:00:00Z`, never `2027-09-23T00:00:00Z` — that date didn't exist as a show date yet. **Dev must restore this one substring, inside `_comment` only, back to `2027-09-16T00:00:00Z`.** Every other date in `_comment` (the live `showStartDateIso`/cutoff/case references) stays shifted to the current 2027-09-23/2027-06-25 values — only the "earlier version...used X" clause is historical narrative. A18/A19 do not block this (A19 was narrowed, see Residue scan amendment below, to check only structural JSON fields, not `_comment` prose) — the restore is pure hygiene, not required for any assertion to pass, included for the same truthfulness reason as the rest of (c′).
- `contracts/checks/vendor-stand-early-bird-pricing/check-tier-selected-either-side-of-cutoff.mjs` — line 43 `showStart`: `2027-09-16T00:00:00Z`→`2027-09-23T00:00:00Z`; line 46 expected-cutoff regex target `2027-06-18`→`2027-06-25`; lines 64–65 boundary instants `2027-06-18T21:59:59.999Z`/`2027-06-18T22:00:00.000Z`→`2027-06-25T...`; line 81 `2027-06-18T23:00:00Z`→`2027-06-25T23:00:00Z`. **Leave lines 51–55 (`movedShowStart` = `2027-10-01`/`2027-07-03`) untouched** — that pair is a deliberately *different*, arbitrary show date proving the function tracks ANY moved date, not the real one; shifting it would be pointless churn. Update comments.
- `contracts/checks/vendor-stand-early-bird-pricing/check-price-derived-from-per-stand-rate.mjs` — line 47 `2027-09-16T00:00:00Z`→`2027-09-23T00:00:00Z`; line 48 fallback `'2027-06-18T00:00:00+02:00'`→`'2027-06-25T00:00:00+02:00'`.
- `contracts/golden/vendor-stand-early-bird-pricing/README.md` — lines 23, 151, 157, 159, 160: "16 September"→"23 September", `2027-06-18`→`2027-06-25`, `2027-06-17T22:00:00Z`→`2027-06-24T22:00:00Z`, `2027-06-18T22:00:00Z`→`2027-06-25T22:00:00Z`.
- `contracts/contract-vendor-stand-early-bird-pricing.yaml` — prose only, lines 31, 34, 70: same date shifts in the assertion `description:` text. Not in `execution/triad-baseline-exempt.txt` (confirmed by grep) — editing it forfeits no grandfather and re-arms no triad gate.
- Companion goldens for the F1/F2 code edits above (not read by any current assertion, but directly describe the scripts being changed): `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json:51-52` (`showDate`/`showEndDate`), `contracts/golden/venue-seed-truth/expected-venue.json:12-13` (same fields; confirmed via grep that `contract-venue-seed-truth.yaml`'s only live check against this file reads `name`/`city`/`province`/`postalCode`, never the date fields), `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json:26-27` (`countdownDate`; confirmed via grep this file is only prose-mentioned, never diffed by any check command) — shift all +7.

**(d) NOS Site lane — do not edit, notify instead:**

`app/(marketing)/national-show/**` belongs to the NOS Site session (branch `origin/nos-site`).
Checked both this working tree (no hits) and `git grep -nE '2027-09-1[6-9]|2027-06-18|16.19 Sept|Thu 16|Sun 19' origin/nos-site -- 'app/'` (zero hits — the NOS site branch's `app/` tree carries no hardcoded instance of the old date pattern today, confirmed, not assumed). Nothing to request a change to. Post the notice below anyway, since their page likely renders the shared `nationalShow` Sanity document this mission's F2 patches, and their own markdown/copy sources (outside `app/`) were not scanned.

**(e) Historical record — leave alone entirely, do not touch:**

- `docs/f3-show-dates-purge-16-19-sept-2027.md` (whole file — history of the *previous* purge, 18–21→16–19)
- `docs/payment-seam.md`, `docs/f1-ticketing-conferences.md:52`, `docs/f4-admission-products.md`'s CTICC/18–21 reference, `docs/f5-day-selection-attendees.md`'s 18–21 narrative — already exempted by the prior mission's A20, not touched again
- `README.md:113` changelog line
- `docs/ticketing-complete-f1.md`, `docs/ticketing-complete-f2-open-decisions.md`, `docs/ticketing-complete-f8.md`, `docs/ticketing-complete-f8-morning-review.md`, `docs/f1-ticketing-pricing-migration.md:107` — all narrate a **past, dated decision** ("on 2026-09-08, VIP's cutoff was set to the then-correct 2027-06-18") in the past tense. Rewriting the number would falsify the historical record of what was actually decided that day — the same "never rewrite incident history" rule the prior purge's A20 established. Leave every one of these as-is.
- `.agent/memory/project/missions/2026-08-21-show-dates-purge-16-19-sept-2027.md` and the `show-dates-purge-16-19-sept-2027` spec/contract/goldens — the record of the prior mission. Leave entirely.
- `docs/b4-national-show.md:57` — describes a `const TARGET_MS = ...` literal in `components/show/ShowCountdown.tsx` that **no longer exists**: confirmed via grep, the real component now reads `countdownDate` dynamically (`const candidate = new Date(countdownDate);`). This doc is stale for a *different*, pre-existing reason (describes dead code), unrelated to which date is correct. Flagged for the maintainer/backlog, not fixed by this mission — fixing it would mean rewriting the whole section's architecture description, out of scope for a date correction.
- `design/design_handoff_saoc/README.md:141,200` ("Countdown target: 2027-09-16T09:00+02:00" / "Countdown: live setInterval to 2027-09-16T09:00+02:00") — **classified (e), QA finding 2026-10-06, see qa-report §3.** This is Brad's active, approved design handoff (project memory `project_design_folders_brad_active`: "leave branding/design spec/logos alone until he says done") — off-limits to edit regardless of which date is correct in it. Do not touch. **One-line flag for Brad's own report, not an action item for this mission:** his design handoff still references the old 16 Sept date twice; whoever next touches that handoff should sync it to 23-26 Sept, but that's his call on his document, not this mission's to make.

## F2 — live Sanity, 4 documents (one more than the precedent's 3)

New script, same shape as `scripts/fix-show-dates-2027.ts`, name it
`scripts/fix-show-dates-23-26-sept-2027.ts`:

- `nationalShow` (`_id: "nationalShow"`) — `.set({ showDate, showEndDate, countdownDate })`
- `show-19-2027` (`_id: "show-19-2027"`, `_type: "show"`) — `.set({ startDate, endDate })`
- `societyEvent-15-19th-south-african-national-orchid-show` — `.set({ date, endDate })`
- **New in this mission:** the "When is the show?" FAQ answer. Its `_id` is ambiguous in this
  repo's own records (the TS seed source uses local id `'showFaq-general-3'`; a historical golden
  file quotes the live `_id` as `"showFaq.general.3"` — dashes vs. dots disagree). **Do not guess
  it.** Query it instead: `*[_type == "showFaq" && question == "When is the show?"][0]._id`, then
  `.set({ answer: 'Thursday 23 to Sunday 26 September 2027, confirmed by the show committee.' })`
  against whatever `_id` that query actually returns.

Constants:
```
SHOW_START_ISO = '2027-09-23T09:00:00+02:00'
SHOW_END_ISO   = '2027-09-26T17:00:00+02:00'
SOCIETY_EVENT_START_DATE = '2027-09-23'
SOCIETY_EVENT_END_DATE   = '2027-09-26'
FAQ_ANSWER_TEXT = 'Thursday 23 to Sunday 26 September 2027, confirmed by the show committee.'
```

Same conventions as the precedent script: reads `.env.local` directly (never hardcodes the
token), `--dry-run` support, `.set()` never `.setIfMissing()` (the fields are already populated
with the stale — now even-staler — 16–19 values), `--verify` mode that queries production and
exits non-zero on any mismatch, idempotent on re-run.

**Execution order matters:** F1 must land first (so `lib/provisional-figures.ts`'s
`CONFIRMED_SHOW_START_2027` already reflects 2027-09-23 before F2's derived-cutoff proof runs),
then the new script is run for real (not just `--dry-run`) against production before the gate's
live-verification assertion can pass. Per standing project memory `project_deploy_authorization`
and `project_sanity_dataset_not_live`, this is pre-production content — writing it is already
authorised, no separate approval needed.

## F3 — docs (current-fact statements only) + residue scan + NOS notice

Update (present-tense, current-fact statements — the same class the precedent's F3 touched):

- `docs/show-visitor-info.md:189`, `docs/show-visitor-info-for-editors.md:56` — "16–19 September 2027" → "23–26 September 2027"
- `docs/menu-system-layout4.md:123` — "Thu 16 – Sun 19 Sept 2027" → "Thu 23 – Sun 26 Sept 2027"
- `docs/m3-home.md:14,36` — "2027-09-16" → "2027-09-23" (describes what `ShowBand` currently counts down to)
- `docs/f4-seed-page-singletons.md:118` — shift +7
- `docs/f4-admission-products.md:22` — "freshly-derived cutoff (2027-06-18...)" → "(2027-06-25...)"
- `docs/dataset-residue-guard.md:83` — shift +7 (illustrative example, kept in sync by convention)
- `docs/f5-day-selection-attendees.md:27,30,32` and `docs/f3-day-visitor-quantity-picker.md:36,38,42,86,103,127,133` — shift every `2027-09-1[6-9]` example +7 days

Leave untouched (historical / NOS-lane / dead-code-describing): see (e) and (d) above — do not
re-sweep these in F3, they are not "current fact" statements.

### NOS Site lane comms.md notice — exact text to append

Append this block, verbatim, to the root `comms.md` (append-only, never rewrite another
project's block):

```
## [SAOC -> FLEET] 2026-10-06 — National Show 2027 dates corrected: 16-19 Sept -> 23-26 Sept

Brad's direct correction (2026-10-06): the National Show 2027 dates are now Thu 23 - Sun 26
September 2027 (previously Thu 16 - Sun 19 Sept, which was itself a correction of an even
earlier 18-21 Sept placeholder).

Checked `app/(marketing)/national-show/**` at `origin/nos-site` directly (git grep for the old
date pattern against that ref's `app/` tree) — zero hits, nothing there hardcodes the old dates
today. No action required on your side for that tree specifically.

What SAOC's mission (`show-dates-23-26-sept-2027`) changed, which your pages may read:
- The live Sanity `nationalShow` document's `showDate`/`showEndDate`/`countdownDate`.
- The live Sanity `show-19-2027` document's `startDate`/`endDate`.
- The live Sanity `societyEvent-15-19th-south-african-national-orchid-show` document's
  `date`/`endDate`.
- The "When is the show?" FAQ answer text in `showVisitorInfo`.

If any NOS-side copy (markdown, hardcoded strings, image assets, print materials) states
16-19 September independently of these Sanity fields, that's yours to find and fix — we only
scanned `app/` on your branch, not your full content tree.
```

## Residue scan (F3's closing assertion)

Full-tree grep for `2027-09-1[6-9]` and `2027-06-18` (and day-name forms "16–19 September",
"Thu 16", "Sun 19"), excluding:
- `node_modules`, `.claude/worktrees`
- `.agent/memory/project/` (mission/spec history, including the prior purge's own spec)
- `docs/f3-show-dates-purge-16-19-sept-2027.md`
- `docs/payment-seam.md`, `docs/f1-ticketing-conferences.md`, `docs/f4-admission-products.md`, `docs/f5-day-selection-attendees.md` (pre-existing 18–21 historical exemptions, unrelated to this sweep, left as-is by the prior mission)
- `docs/ticketing-complete-f1.md`, `docs/ticketing-complete-f2-open-decisions.md`, `docs/ticketing-complete-f8.md`, `docs/ticketing-complete-f8-morning-review.md`, `docs/f1-ticketing-pricing-migration.md`, `docs/b4-national-show.md` (historical-narrative / dead-code-describing exemptions, this mission, see (e))
- `README.md` (changelog line)
- `docs/nos-design-system.md` (NOS-lane-adjacent)
- `e2e/mega-menu-f8-logo-and-tickets-rail.spec.ts` (historical comment)
- `contracts/checks/ticketing-f4-admission-products/`, `contracts/checks/ticketing-flow-redesign-f3/`, `contracts/golden/ticketing-flow-redesign-f3/`, `contracts/checks/cms-loop-f3-national-show/`, `contracts/golden/dataset-residue-guard/`, `contracts/checks/vendor-gated-registration-flow/check-application-approval-email-copy.mjs`, `contracts/golden/f5-event-slugs/`, `contracts/golden/venue-never-changed-copy-fix-f1/`, `contracts/checks/ticketing-f5-day-attendees/`, `contracts/golden/ticketing-f5-day-attendees/` (arbitrary/self-exempted fixtures, see (c))
- `scripts/fix-show-dates-2027.ts`, `scripts/fix-visitor-info-dates-confirmed.ts` (the *previous* mission's one-off patch scripts — now historical record of what they did at the time, same status `fix-show-dates-2027.ts` itself had relative to the 18-21 purge before it)

Anything matching outside that allowlist after F1–F3 land is a real miss — fix it or escalate,
don't silently widen the allowlist to make it pass.

### Amendment, 2026-10-06 (QA finding, see `.agent/memory/scratch/qa-report-show-dates-f1-f2.md`)

A31's actual grep command had two gaps beyond the allowlist written above, both now fixed in
`contract-m1.yaml`:

1. **Unquoted `--include=*.ext` globs.** In zsh (this project's documented shell,
   `.claude/rules/shell-paths.md`), an unquoted glob is expanded by the shell *before* grep ever
   sees it; if no file named literally `*.ts` exists in cwd, the token can pass through unchanged
   and still work by accident, but the behaviour is shell-dependent and not guaranteed —
   quoting (`--include='*.ts'`) removes the ambiguity entirely. Done in the amended command.
2. **Allowlist gaps** — these paths contain real matches that are not residue and were missing
   from the original list:
   - `.agent/memory/scratch/` and `.tmp/` — both gitignored scratch areas (QA report, sandbox
     files); never residue, just not previously excluded.
   - `contracts/checks/ticketing-complete-f8/verify-walkthrough-figures.mjs` — a historical
     "proposed" example, same class as the other ticketing-complete-f8 docs in (e).
   - `contracts/golden/show-visitor-info/show-identity-surfaces.golden.md` and
     `show-identity-wiring.golden.md` — narrate the `DEFAULT_COUNTDOWN_DATE`/dataset-state history
     against the old 2027-09-18 value; historical narrative, same class as (e).
   - Content-matched (not file-matched, so the exclusion survives future line renumbering):
     `"countdownDate is 2027-09-18T09:00:00"` (the one historical line inside
     `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json` — this file's
     *current* `showDate`/`showEndDate` fields are legitimately checked by A21 and must NOT be
     blanket-excluded, only this one historical sentence); `"second hand-typed copy of
     '2027-06-18'"` (the illustrative anti-pattern comment in
     `lib/provisional-figures.ts:78`); `"hardcoded '2027-06-18'"` (the matching anti-pattern
     comment shared by `contracts/checks/ticketing-complete-f2/check-vip-migration-plan-cutoff.mjs`
     and `check-vip-stored-cutoff-derived.mjs`).
   - `.scratch-render/render-email.mjs` — tracked-but-scratch-named render helper with sample
     `loadOutSlot` test data, same class as the already-accepted vendor-form exemption in (c).
   - `design/design_handoff_saoc/README.md` — see (e) above; Brad's active design lane, never
     edited by this mission regardless of what it says about the date.

None of these were missing *findings* to fix — each is a correctly-excluded non-residue
reference. The gap was that A31's command didn't yet exclude them, so it would have false-flagged
every one of them as a miss. Fixed in-place; no new exclusion here widens the allowlist to hide a
real stale date — see each bullet's reasoning above.

### Amendment #2, 2026-10-06 (dev's F3 run, see `.agent/memory/scratch/dev-result-show-dates-f3.md`)

Dev ran A31 for real under `bash -c` (the gate shell) after landing F3's docs sweep and got a
genuine **FAIL** — 6 hits outside the then-current allowlist, all of which dev correctly left
untouched rather than guess-editing. Verified each by reading the file directly; all 6 are
historical narrative or a pre-existing wrapping miss, none is current-fact residue:

1. `Plans/valiant-squishing-thimble.md:211` — "Stage 7 — Purge the placeholder show dates..."
   narrates the **prior** 18-21→16-19 purge trigger, written before that purge happened.
   Confirmed via `grep -c` this is the file's only matching line, and the only matching file in
   `Plans/` — excluded whole-file (`^./Plans/valiant-squishing-thimble.md:`), not the whole
   directory, so any other plan file dropped into `Plans/` with genuine current-fact residue is
   still caught.
2. `contracts/checks/ticketing-complete-f2/check-vip-fix-scope-containment.mjs:6` — comment
   "...onto the engine-derived 90-day cutoff ('2027-06-18')", narrating the 2026-09-08 decision in
   past tense. Same class as the already-allowlisted "hardcoded '2027-06-18'" comment in its
   sibling files, missed because this file's exact wording differs. Content-matched exclude added:
   `"90-day cutoff ('2027-06-18')"`.
3. `contracts/golden/show-visitor-info/seed-show-visitor-info.golden.json:56` —
   `datesAreNotConfirmed` field quoting the **prior** mission's Lee-Ann confirmation ("the show
   committee has since confirmed the dates (Lee-Ann, 2027-09-16 to 2027-09-19)"), correctly
   preserved history. The file's existing content-matched exclude only covered a separate sentence
   elsewhere in the same file. Content-matched exclude added:
   `"confirmed the dates (Lee-Ann, 2027-09-16 to 2027-09-19)"`.
4. `contracts/golden/f4-seed-page-singletons/nationalShow.golden.json:27` — `note` field's
   "AMENDED by the show-dates-purge-16-19-sept-2027 mission..." clause, F1's own historical
   narration of the *prior* mission sitting next to the separate "AMENDED AGAIN" clause this
   mission added (which correctly uses 2027-09-23/26 and is unaffected). Content-matched exclude
   added: `"the show committee confirmed the real dates (Lee-Ann, 2027-09-16 to 2027-09-19)"`.
5. `docs/show-visitor-info.md:110` — describes the unrelated, now-**deleted**
   `DEFAULT_COUNTDOWN_DATE = '2027-09-18T09:00:00+02:00'` anti-pattern on dead code
   (`ShowCountdown.tsx` no longer has this constant) — a different placeholder, a different
   reason, never this mission's date to move. The golden's F3 list named only this file's line
   189. Content-matched exclude added: `"DEFAULT_COUNTDOWN_DATE = '2027-09-18T09:00:00+02:00'"`.
6. `lib/provisional-figures.ts:78` — the actual matched line is "'2027-06-18'. The literal show
   start below is the same confirmed instant used as ground"; the previously-added exclusion
   string ("second hand-typed copy of '2027-06-18'") sits on the **previous** source line (77) of
   the same wrapped comment, so grep's per-line match never coincided with it. Pre-existing
   allowlist bug (confirmed via `git diff` the wrapping predates this mission), not introduced by
   F1. Content-matched exclude added: `"The literal show start below is the same confirmed
   instant used as ground"`.

**Re-run and verified by the architect** (not dev, not just claimed): `bash -c` against the
amended command from `contract-m1.yaml` exits 0 (PASS) against the live tree. Negative control:
a synthetic file under `.tmp/sandbox/` containing a fabricated `2027-09-16`/`2027-09-19` line was
run through the identical regex + full `grep -v` chain and survived every filter (non-zero
output) — proving the new exclusions are narrow enough that unrelated residue still gets caught.
Confirmed analytically in addition: neither `lib/data/events.ts` nor `lib/show-identity.ts` (this
mission's two main current-fact source files) appears anywhere in A31's exclusion list, so a
reintroduced stale date in either would still fail the gate.
