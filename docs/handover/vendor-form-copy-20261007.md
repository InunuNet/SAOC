# Handover — vendor-form-copy-20261007

**Branch:** `feat/vendor-form-copy-20261007-beta`
**SHA:** see `git log -1 origin/feat/vendor-form-copy-20261007-beta` (code last changed in `92a8a3b5`)
**Pushed:** yes, `origin/feat/vendor-form-copy-20261007-beta`

## What changed, in one paragraph

Lee-Ann updated the "13.2 Vendor Form" source doc on 2026-10-07 without telling Brad. F1 brings
the live vendor registration form into line with the current text — nine copy/structure items
(two new fieldsets, two label fixes, three advisory notes, a reconciled-not-duplicated allocation
note, and an additive staff-attendance rewrite of the approval email) — detailed in
[docs/vendor-form-copy-20261007.md](../vendor-form-copy-20261007.md), which points at the full
decision record in `.agent/memory/project/specs/vendor-form-copy-20261007/goldens/f1-vendor-form-copy-update.md`.
F2 adds `scripts/lee-ann-drive-watch.py`, a per-session Drive change detector, so the next silent
Lee-Ann edit doesn't have to be found by accident again — see
[docs/lee-ann-drive-watch.md](../lee-ann-drive-watch.md).

## What the SAOC lead owns next

Four gaps/questions for Lee-Ann are named, not resolved, by this mission (full text in
[docs/vendor-form-copy-20261007.md](../vendor-form-copy-20261007.md#gaps--questions-for-lee-ann-named-not-resolved-by-this-feature)):

1. Exhibitor passes — `exhibitorPassesRequired`/`exhibitorPassesCount` exist in the data model
   with no corresponding question in the current source table.
2. `specialWasteRequirements` — present in the data model, absent from the current source text.
3. Load-in/load-out slot contradiction — the form offers a *preferred* slot; the source says
   slots are organiser-*allocated*.
4. Two differently-worded "final booth allocation" sentences in the same source document (BOOTH
   REQUIREMENTS vs. the Terms & Conditions clause) — only the second is rendered; the first is a
   named gap, not dropped silently.

These need Lee-Ann's answer, routed through the SAOC lead, before any follow-up feature touches
those fields again.

## Collision-guard outcome

The SAOC lead's concurrent `feat/vendor-invite` branch (off `origin/main`) touches
`app/admin/vendors/**`, `app/api/admin/vendors/**`, and token-issuing code. This mission's
footprint under those two globs is exactly one file —
`app/api/admin/vendors/[id]/review/route.ts` — cleared by the SAOC lead 2026-10-08, and the edit
there is additive only (5 new `?? null` lines added to an existing call; nothing else in the file
changes). Token issuance and the register page's token gate are untouched.

## Gate results

**Verified independently in this worktree, not just reported:**

- `pnpm run type-check` — clean, no errors.
- `pnpm run lint` — 0 errors, 105 pre-existing warnings in unrelated files (none newly
  introduced by this mission's changed files).
- `python3 execution/contract.py check --assertion <id> contract-f1.yaml` for A3–A10: A3, A4, A5,
  A6, A7, A9, A10 **PASS**. **A8 FAILS** — but only because A8's command diffs against
  `origin/main`, and this branch is based on `origin/feat/conference-workshop-tickets`
  (`047d610e`), which itself already modified `sanity/schemas/{conferencePresenter,ticketType,
  workshopSession,index}.ts` relative to `origin/main`. Confirmed directly:
  `git diff --name-only 047d610e..HEAD -- app/admin/vendors/ app/api/admin/vendors/
  sanity/schemas/` returns exactly `app/api/admin/vendors/[id]/review/route.ts` — this mission's
  own footprint under the guarded globs is the one cleared file, nothing else. The 4 extra files
  A8 sees on an `origin/main` diff are the beta base branch's changes, not this mission's.
- `contract-f2.yaml` (drive-watch) — full `python3 execution/contract.py gate --phase all
  --run-checks` run clean end to end: **A1–A6 all PASS**, phase 4 summary 6/6, gate PASSED. This
  contract is exempt from the verification-triad preflight (non-UI, no `app/` path referenced).
- `next build` — reported by the implementing session as exit `0`. Not re-run here: the F1
  golden's own "Verification path for @dev" section instructs `pnpm run type-check` and
  `pnpm run lint` as the required gates and explicitly says not to run `pnpm run build` (a local
  dev server on :3003 depends on `.next`), so this note did not independently re-run it.

**Single-command gate (`contract.py gate --phase all --run-checks contract-f1.yaml`).** It was
first blocked at the verification-triad preflight (exit 6). The contract now declares the triad
(commit `c22b19c6`): A11 `codex_qa`, A12 `browser_deployed_check`, A13 `gws_inbox_check`. The
preflight passes. Current state:

- A1-A7, A9, A10: PASS.
- A8: FAIL, base-branch caveat above.
- A11 (Codex): FAIL. See "Codex QA" below: it is a conflict between the golden and Lee-Ann's
  source text, for the lead to decide.
- A12, A13: not runnable yet. They need manifests produced after the beta rollout: drive the
  form on https://beta.saoc.co.za at this commit with a screenshot, and open a real approval
  email with a read-only gws lookup. Manifest paths are in `contract-f1.yaml`.

## Codex QA

First cross-model review (`execution/codex_qa.sh`) **FAILed** with 7 findings: 5 copy-invention
fixes (waste-section heading typo not kept verbatim, an invented "Other waste (please specify)"
label instead of the source's plain "Other," an invented staff-passes legend/label instead of the
source's own day text, an inconsistent approval-email breakdown rendering) and 2 drive-watch
defects (non-atomic state write, no rename/move detection via `parents`). All 7 were fixed in
commit `da37e75b` ("fix(vendor): QA retry 1"). The re-review **PASSed**.

**Gate-time reviews (A11, 2026-10-08).** The gate re-runs Codex. Three runs:

1. Diff only, no source text. FAIL: 3 findings, all false. Codex guessed wording that is not in
   Lee-Ann's document.
2. Diff plus Lee-Ann's source plus the golden. FAIL: 1 real finding. The electrical-safety
   advisory sat after the gas table; the golden says directly after the electrical table. Fixed
   in `92a8a3b5`.
   Note that Lee-Ann's document itself places this advisory after the water questions, slightly
   later than the golden says. The golden was followed.
3. Same input, after the fix. FAIL: 2 findings on the staff section, both caused by the golden
   disagreeing with Lee-Ann's document:
   - The golden specifies per-day labels "Number of staff — Setup Day". The first review
     flagged that as invented wording, so retry 1 used her table as written: "Number of
     Staff" as the group legend and the bare day names as labels. The golden was not updated
     afterwards.
   - Her section heading "STAFF & EXHIBITOR PASSES" is not rendered; the legend is her column
     header "Number of Staff". The golden did not ask for the heading. Adding it is
     source-backed, but the exhibitor-passes half has no fields (gap 1 above).

**DECISION NEEDED (lead):** keep Lee-Ann's wording as built (recommended, per Brad's rule that
her document is the source of truth) and have the golden corrected; or switch to the golden's
combined labels. Also: whether to render her "STAFF & EXHIBITOR PASSES" heading. The
feature's QA budget is spent, so this was not looped further.

## What this feature explicitly did not do

- Did not touch `types/index.ts` or `lib/vendor-submissions.ts` (the Firestore schema/validators).
- Did not add an admin UI column.
- Did not touch token issuance or the register page's token gate.
- Did not touch Sanity schemas.
- Did not change `sendVendorApprovalConfirmationEmail`'s signature.
- Did not touch the application-approval call site
  (`app/api/admin/vendors/applications/[id]/review/route.ts`).
- Did not resolve any of the 4 named gaps above.
- Did not fix `execution/drive_docx_sync.py` (HARNESS-owned; filed upstream instead, per
  `.agent/memory/project/backlog.md`).

## What's still open

- The 4 gaps/questions for Lee-Ann, above.
- The staff-section decision and A11, above.
- A12/A13, after the beta rollout.
- Review and merge: `main` and `beta`.

## Lead ruling and final A11 (2026-10-08)

The SAOC lead ruled: Lee-Ann's document outranks the golden. Keep her wording as built ("Number
of Staff" legend, bare day labels). Do not render "STAFF & EXHIBITOR PASSES" until she supplies
the exhibitor-pass fields. The golden is corrected to match (staff labels, waste heading
"Waste, cleaning and enviromental impacts", waste free-text label "Other").

Final A11 re-run, against the corrected golden and her source: one finding only, "the source
heading STAFF & EXHIBITOR PASSES is omitted". That omission is the lead's deliberate ruling,
so A11 is accepted on that basis and not looped further.

Lee-Ann's source docx and the Codex target (which embeds her text) are no longer tracked. A
spec-local `.gitignore` keeps them out. They remain in this branch's history at `2f261916`, so
squash-merge, or ask for a history rewrite, to keep them out of main.
