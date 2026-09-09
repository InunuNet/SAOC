# Site Content Alignment (mission `site-content-alignment`, M1/F1 + M2/F2 + M2/F3-F4)

Aligns the SAOC site against Lee-Ann's Drive content inventory. M1 (`@architect`,
no production code) produced the audit and every downstream spec. M2/F2 was the
first buildable-now increment: snapshot mirroring, provisional-marker
unification, and a nav-comment correction. M2/F3-F4 (this update) built the two
404ing nav routes that actually have source documents. See
[`docs/rules/no-invention.md`](rules/no-invention.md) for the governing rule this
whole mission implements.

## The governing model

Lee-Ann's Drive tree (`Docs for Brad/National Show/...` and
`Docs for Brad/SAOC/...`) is the **content inventory and coverage contract** — it
says which pages must exist and which have official committee copy. It is **not**
a literal folder-to-URL map. Nav structure, route shape, and page IA are
engineering decisions made against the approved design handoff
(`design/design_handoff_saoc/`), not against her folder numbering. A page with no
source document is **provisional**: visibly and accessibly marked as awaiting
official SAOC copy, never written in SAOC's institutional voice, never presented
as sourced.

## Coverage map

`.agent/memory/project/specs/site-content-alignment/goldens/fixtures/f1-coverage-map.json`
is the authoritative record: 20 sections total (6 SAOC + 14 National Show), each
carrying **`routeStatus`** (`built` / `gap-nav-only`) and **`contentStatus`**
(`sourced` / `provisional` / `blocked-on-leeann`) as two independent fields — kept
separate deliberately, so a page's build progress is never conflated with whether
its copy is real. `driftDetection` documents the method for re-checking the map
against live Drive folders, but is explicitly `runInGate: false` — the contract
gate has no guaranteed network/Drive credential access, so drift detection is a
periodic manual re-run, not an automated check.

**Numbering gaps:** folders 8, 9, 10, 14, and 16 in the National Show tree are
confirmed genuinely absent (independently re-verified, not a listing artifact).
There is also one unnumbered top-level spec doc in the National Show Drive root,
alongside the 13 numbered subfolders. Neither is characterised yet — both are
open questions for Lee-Ann (`f1-questions-for-leeann.md` Q2 and Q11).

## `StatusMarker.tsx` — unified provisional/confirmation marker

`components/show/_shared/StatusMarker.tsx` is the new shared render path for the
markers previously duplicated across `ExhibitorStatusBadge.tsx` and
`ConfirmationBadge.tsx`. Both are now thin wrappers that keep their existing
public prop names (no call site changed) and delegate to `StatusMarker` via a
`kind: 'exhibitor' | 'confirmation'` discriminator.

`kind` exists because the two source components have different status
vocabularies: `types/index.ts:370` `ExhibitorStatus` is a 4-value union
(`'pending' | 'research' | 'question' | 'confirmed'`); `types/index.ts:241`
`ConfirmationStatus` is a 3-value union with no `question`. `question` is
exhibitor-specific semantics — an open question put to the committee, not merely
"not yet confirmed" — and is **not** collapsed into `pending`: only the
`kind === 'exhibitor'` branch reads or produces it.

This was a **byte-identical refactor, not a redesign**: `TONE_CLASSES`, the
markup shell, and each kind's fallback-label logic are reproduced verbatim from
the two pre-unification components. No new colour, spacing, or typography token
was introduced. The fail-closed shape is preserved twice over — one early return
on the literal string `'confirmed'`, and hardcoded fallback label constants
(`FALLBACK_LABEL`, `FALLBACK_PENDING_LABEL`, `FALLBACK_RESEARCH_LABEL`) that a
cleared Sanity field cannot lower, per the incident that motivated this pattern
(23 blank boxes when an editor cleared `showVisitorInfo.pendingLabel`). Every
marker instance keeps a `data-*` attribute (`data-exhibitor-marker` /
`data-confirmation-badge`) holding the *resolved* status, not the raw upstream
value, so a marker is structurally countable rather than string-matched.

`ProvisionalFigure`, `SocietyFacts`'s inline placeholder, and
`TicketTypeCard`'s badge were **not** merged into `StatusMarker` — they operate
at a different granularity (inline figure / inline estimate line / pricing-card
badge vs. a section-level block marker) — but share the same `data-*` and
status-vocabulary convention where it fits.

### Open question — not resolved by this feature

The design handoff's `SKILL.md` ("Asking for missing material") specifies a
literal `[bracket]` placeholder convention in prose. All five shipped marker
components instead use a bordered mono-tag badge — token-compliant (verified: no
invented colours, only handoff CSS variables) but not a literal implementation of
the bracket rule. **Brad has not ruled on whether the badge pattern is an
acceptable engineering translation of the handoff, or whether he wants literal
bracket-style copy.** This feature deliberately continues the existing badge
pattern (least-change, already shipped, already token-compliant) and does not
redesign the visual treatment on its own initiative. See
`f1-provisional-unification.md` §"Open question for Brad" and
`f1-questions-for-leeann.md` Q8.

## `nav-config.ts` comment correction

`components/chrome/nav-config.ts:10-25` previously said Lee-Ann's Drive
numbering is document order, not IA, and that the file "guarantees every one of
those six destinations stays reachable" — written when only the 6 SAOC sections
were being reconciled. The comment now keeps that still-true point, marks the
"six destinations" framing superseded (the same reachability guarantee now
covers all 20 sections), and points at `f1-coverage-map.json` as the
section-to-route source of truth, cross-referencing
`f6-pending-nos-routes.json` for the open route-gap list rather than restating
it inline — so the two files can't drift apart. This was a **comment-only
change**: `nav-config.ts`'s body from `export interface NavLeaf` onward is
byte-identical to its pre-F2 baseline (verified by diff against
`f2-nav-config-body-baseline.txt`), zero structural or href changes.

## Drive snapshots added this feature

Five new snapshots landed in `docs/leeann-source/` (About National Show, What to
Expect, Symposium Theme, Show Contact Information, Ticketing System Details) —
see [`docs/leeann-source/README.md`](leeann-source/README.md) for the full
index and header convention. The FAQ document
(`17.1 Frequently asked questions.docx`) is recorded there as **BLOCKED**, not
silently skipped — see that file's own section below for the corrected
diagnosis.

## Known gaps — recorded honestly, not smoothed over

**Five nav links 404 in production today:** `/national-show/about`,
`/national-show/programme`, `/national-show/symposium`,
`/national-show/wosa-conference`, `/national-show/exhibitors/international`.
These are pre-existing from the concurrent `ticketing-complete` mission's nav
restructure, **not F2 regressions** — `@qa` re-verified by grepping
`nav-config.ts`'s hrefs against
`.agent/memory/project/specs/ticketing-complete/goldens/fixtures/f6-pending-nos-routes.json`
and confirmed an exact, set-for-set match. Both things are true at once: not a
regression from this feature, and a real dead link a visitor can click on the
live site right now.

**`A17` (`browser_deployed_check`) did not formally run** — no Chrome-extension
tooling was available this session. As a substitution, `@qa` fetched the
deployed origin (`https://beta.saoc.co.za`) directly and confirmed
`data-confirmation-badge="pending"` renders in the server-rendered HTML on
`/national-show/what-to-expect` and `/national-show/plan-your-visit`. This
**does prove** `StatusMarker` is reached at runtime and renders real DOM with a
resolved status value on two of three target pages (and since it is a Server
Component, SSR HTML is authoritative for this property). This **does not
prove** full `A17` compliance — no viewport, accessibility, or visual
inspection was done. A real browser pass is still owed when Chrome-extension
tooling is available.

**`/national-show` itself renders zero markers, and this is unresolved, not
confirmed-benign.** The page's source (`app/(marketing)/national-show/page.tsx:272,529`)
renders `<ConfirmationBadge status={datesStatus} .../>` unconditionally in both
places, yet the deployed page's 86.5KB of rendered HTML contains zero
`data-confirmation-badge` bytes. The plausible explanation is that `datesStatus`
currently resolves to `'confirmed'` on this deployment, which would make the
null render correct fail-closed behaviour rather than a bug — but `@qa` did not
trace `datesStatus`'s resolution back to its Sanity source to confirm that
versus a swallowed error, build staleness, or a prop-wiring break. Recorded as
an open question for the mission, not as a cleared page.

**`A15` is brittle to line-wrapping.** The nav-comment check is a literal
single-line substring grep for the required verbatim phrase. `@dev` hit this
once (a first draft wrapped the phrase across two comment lines) and
self-corrected before reporting. This is a false-negative risk only — it can
reject a correct-in-substance implementation over formatting, never let a
broken one through — so it was judged not an instance of the "assertion
satisfiable by something that isn't the real property" defect class.

## Corrections folded into this feature

- **Symposium Theme doc:** earlier characterised as "a native Google Doc,
  wrong fetch subcommand." Re-verified: it is a real `.docx`
  (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`),
  fetched fine via the standard `drive files get alt=media` route like every
  other `.docx` in the tree. `f1-questions-for-leeann.md` Q4 is resolved, not
  open.
- **FAQ doc diagnosis corrected.** See
  [`docs/leeann-source/README.md`](leeann-source/README.md) for the verified
  facts: file id `1soLx8vKPs1jQBnYFTu88_LWxjzRFTHsf`, 23,731 bytes, our
  download's md5 matches Drive's own reported md5
  (`27f4911dc51dfada43b242104b627c0e`) byte-for-byte, valid `PK\x03\x04`
  magic number, 16 readable local file headers — but the End-of-Central-
  Directory record is absent, so no reader can extract it. This is a **file
  truncated at rest in Drive**, not a local tooling or re-download problem.
  Unrecoverable on our side across five independent read attempts; Lee-Ann
  needs to re-save/re-export it, or supply it as a native Google Doc instead.

## Scope boundary

The About and What-to-Expect source docs mention WOSA presenting at the
Symposium. SAOC is orchids **in cultivation**; wild-orchid identification,
habitat, and conservation content belongs to WOSA, a separate organisation.
Where these docs reference WOSA, the site attributes and links to WOSA — it is
never authored in SAOC's own voice.

## M2/F3-F4 — `/national-show/about` (new) and `/national-show/what-to-expect` (reconciled)

Of the five nav links that 404'd in production (recorded above), F3 built the
**only two** that have a real source document:

- **`/national-show/about`** — new route, built verbatim from
  `docs/leeann-source/about-national-show_2026-09-09.md`.
- **`/national-show/what-to-expect`** — existing route, reconciled against
  `docs/leeann-source/what-to-expect_2026-09-09.md`. The page previously carried
  only Sanity-driven visitor-logistics copy (hours/admission/food) with **none**
  of the doc's narrative; F3 added the missing sourced narrative section above
  that existing content, removing nothing.

Both pages credit and link WOSA (`wildorchids.co.za`) wherever the source docs
mention WOSA's symposium presentations — never authored in SAOC's own voice, per
the scope boundary above. `@qa` independently verified this with a full-paragraph
substring diff against both source docs (stronger than a canary-phrase grep):
exact match, no paraphrase, no dropped qualifier, no added claim.

**Reachability (F4), scoped per `goldens/f3-f4-scope-note.md`:** wired through
`components/show/ShowSectionNav.tsx`'s `SECTION_LINKS` array and the hub page's
(`app/(marketing)/national-show/page.tsx`) `VISITOR_CARDS` array — **not**
`nav-config.ts` or `Footer.tsx`, which were already dirty from the concurrent
`ticketing-complete` mission and out of scope for this feature (see
`f1-baseline-dirty-files.json`). This is deliberately not a full 20-section
reachability sweep — just guaranteeing these two pages aren't one-nav-item-deep.
A broader audit of all 15 already-built sections remains open follow-on work.

`f6-pending-nos-routes.json` and `f1-coverage-map.json` were both updated in the
same change: `/national-show/about` removed from the pending list, `nos-2-about`
flipped to `routeStatus: built` with its real `sourceDocSnapshot` path — so the
two tracking files can't drift apart.

**Deliberately NOT built, and why:** `/national-show/programme`, `/symposium`,
`/wosa-conference`, `/exhibitors/international` have no source document and stay
gated on Lee-Ann in M3. The Symposium Theme doc is a one-sentence theme
statement — ruled a fragment, not page copy. **No placeholder pages were created
to make the nav look green.** All four still 404 in production, and
`f6-pending-nos-routes.json` still lists all four — say so plainly.

### `@qa` verdict: FAIL — two blockers, recorded honestly

1. **A14 (`browser_deployed_check`) — a real FAIL, not a tooling gap.** The
   contract requires a deployed-origin fallback when the Chrome extension is
   unavailable ("never silently skip"). That fallback was not performed before
   the feature was reported — `@qa` ran it directly against
   `https://beta.saoc.co.za` and found `/national-show/about` 404ing live and
   `/national-show/what-to-expect` still serving pre-F3 content, because the
   work was uncommitted and undeployed at the time. **The correct diagnosis is
   "not deployed," not "tooling unavailable"** — the initial framing was wrong
   and the correction matters: this was undone work, not an environment
   limitation.
2. **A15 (`codex_qa`) — could not execute, a contract defect in our own YAML.**
   `execution/contract.py` passes `verify.get("target", "")` to
   `codex_qa.sh`; A15's entry in `contract-f3.yaml` has no `target:` field, so
   the script received an empty argument and exited 2 (wrapper usage error) —
   correct fail-safe behaviour on `codex_qa.sh`'s part, not an Athanor/harness
   bug. A separate `@architect` dispatch is fixing the contract. A manual Codex
   GPT-5.5 pass against the real F3 diff was run outside the gate and returned
   PASS with no findings — real signal, but it does not make the automated
   assertion runnable unattended.

A1-A13 were independently reproduced by `@qa` with full-paragraph substring
diffs (stronger evidence than the canary greps alone): both pages are exact
matches of their source docs, the four gated routes remain absent with their
negative-control pairing intact, and `nav-config.ts`'s body is byte-identical to
the F2 baseline (F3 required zero nav structural changes).

`prettier --check` warns on all 4 touched files. Not wired into
`.github/workflows/ci.yml` (confirmed absent), so a pre-commit cleanup item, not
a gate failure.

### Lesson: an assertion that can't execute is worse than no check

Two live instances of "green means nothing" surfaced in this pass:
`mission.py gate --milestone M2` returned `PASS (0 ran, 0 skipped)` while wired
to no assertions, and A15 errored out rather than evaluating anything. Both
belong to this repo's audited "assertion satisfiable by something that isn't the
real property" defect class in `.agent/memory/project/learned.md` — a gate wired
to nothing, or an assertion that cannot run, manufactures false confidence
rather than simply providing none. A14, by contrast, was soundly authored (it
correctly required live-DOM proof and even specified its own fallback) — its
failure was in execution/process, not the check's design.

## Open questions for Lee-Ann / Brad

11 items are consolidated in
`.agent/memory/project/specs/site-content-alignment/goldens/f1-questions-for-leeann.md`,
including the truncated FAQ, the unfinished Show Contact doc (5 candidate
contact audiences with no stated routing decision), and the unknown content of
folders 8/9/10/14/16. Not yet sent as of this writing.

## What this feature did not do

M2/F3-F4 built `/national-show/about` and reconciled `/national-show/what-to-expect`
(see section above) — the only two of the five 404ing nav routes with a source
document. The Lee-Ann-gated Symposium/WOSA Conference/International
Exhibitors/Programme/Show Contact builds remain separate, later work — M3 is
explicitly blocked on Lee-Ann's answers and must not be built against invented
placeholders in the meantime. F3-F4 also did not resolve the A14/A15 verdict
above (both FAIL, tracked as open follow-on work: deploy F3 for real and fix
`contract-f3.yaml`'s A15 `target:` field), nor did it perform the broader
15-section reachability audit noted in the scope note.
