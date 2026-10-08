# Handover — vendor-form-copy-20261007

**Branch:** `feat/vendor-form-copy-20261007-beta`
**SHA:** `ad0b158f1ceb654eb7ae211883271db79100ffe8`
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

**One finding beyond what was reported, worth flagging:** running the orchestrating
`python3 execution/contract.py gate --phase all --run-checks contract-f1.yaml` (as opposed to
checking each assertion individually, above) is currently **BLOCKED at the verification-triad
preflight** (exit code 6): `contract-f1.yaml` references an `app/` path, is classified as a
UI/workflow contract, and is missing the `codex_qa`/`browser_deployed_check`/`gws_inbox_check`
triad kinds with no baseline-exemption pin. Every individual assertion passes (per above), but the
single-command gate for F1 does not currently go green — see
[docs/verification-triad-gate.md](../verification-triad-gate.md) for the mechanism. This is a
contract-authoring gap (adding the triad assertions, or a justified
`execution/triad-baseline-exempt.txt` entry), not a code defect; it is for `@architect` to close,
not `@docs`.

## Codex QA

First cross-model review (`execution/codex_qa.sh`) **FAILed** with 7 findings: 5 copy-invention
fixes (waste-section heading typo not kept verbatim, an invented "Other waste (please specify)"
label instead of the source's plain "Other," an invented staff-passes legend/label instead of the
source's own day text, an inconsistent approval-email breakdown rendering) and 2 drive-watch
defects (non-atomic state write, no rename/move detection via `parents`). All 7 were fixed in
commit `da37e75b` ("fix(vendor): QA retry 1"). The re-review **PASSed**.

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
- The verification-triad preflight gap on `contract-f1.yaml`, above.
- Review and merge: `main` and `beta`.
