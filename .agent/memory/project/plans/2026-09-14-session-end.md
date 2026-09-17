# SESSION END 2026-09-14 — nos-site (saocnosdesign-22)

Written as a git-tracked companion to the brain.py entry (`mem_20260914_203021_b46123ac`,
495 words) per Brad's standing instruction that every session leaves a durable reference
point independent of brain's local chromadb store — see `learned.md` on why brain-only
records have been lost before (Athanor#1437, and the 2026-07-29 scratch-purge incidents).

**No code changes this session.** Pure investigation, cross-session coordination, and one
filesystem rename. Brad's closing instruction: **stop, do no further work, triage in the
morning.**

## 1. Directory rename

`/Users/vetus/ai/SaocNosDesign` → `/Users/vetus/ai/SaocNosSite`, at Brad's explicit
instruction — the old name wrongly said "Design" when this checkout/session is the
**nos-site** lane, not nos-design. Branch and remote were already correct (`nos-site`,
tracking `origin/nos-site`, clean); only the local folder name was wrong. All rule files
(`.claude/rules/*.md`) reference the project by relative/absolute path — CLAUDE.md and repo
content are unaffected, only this machine's local path changed.

## 2. brain.py — status update

Confirmed cross-session (with peer `saoc-5e`) that the wrap-up failure filed as
**InunuNet/Athanor#1437 (P0)** is machine-local (a stale `~/.athanor-env` symlinked to
Python 3.9.6), not a shared harness code defect — other lanes whose calling interpreter
already has `chromadb` never hit the broken re-exec path.

**New this session: `brain.py wrap-up` succeeded without any manual venv rebuild** (this
file's own commands ran clean). Not yet understood why — possibly another lane sharing this
`$HOME` fixed `~/.athanor-env` independently, or the calling interpreter changed. **Worth
verifying in the morning** whether Athanor#1437 should be marked resolved/self-resolved
before assuming it's still open.

## 3. national-show-ia-alignment — real status (not the stale mission-file frontmatter)

`missions/2026-09-09-national-show-ia-alignment.md`'s YAML frontmatter and
`missions/active.json` checkpoint are both **stale**, frozen at M1/F1 from 2026-09-09,
despite M1 through M4 (F1-F24) actually being built per git history. Same defect class as
the brain.py memory-loss problem — `mission.py`'s own checkpoint-write reliability is
worth a backlog line, not just brain's.

**Real state, verified this session:**
- All 17 approved pages exist and render: 6 newly built (`programme`, `symposium`,
  `wosa-conference`, `sa-exhibitors`, `international-guests`, `sponsors`), 5 reconciled
  onto existing routes, 5 preserved untouched, hub restructured into 4 groups.
- `contract-m4.yaml` per-assertion run: 61 pass / 30 fail / 1 error — not a clean gate
  (the harness's own `contract.py gate --phase max` is separately broken, Athanor#1436).
- **PR #4 (`nos-site` → `main`) is OPEN but `mergeable: CONFLICTING`** — 7 merge conflicts
  (memory/config files only, no source) — and per the standing instruction in
  `plans/2026-09-11-m4-closeout.md`, **must not merge** until `sanity/lib/fetch.ts`'s
  swallow-to-null bug is fixed. That bug is shared infrastructure (30 callers repo-wide,
  not just this mission's six routes) — a Sanity outage or missing env var is
  indistinguishable from "no document" and renders publicly as "content not yet
  published" in the Council's voice. **Confirmed still unfixed at session end** —
  `sanity/lib/fetch.ts:17,24,34-36` unchanged, last touched by unrelated commits
  (`ab3a291d`, `bc966600`).
- FAQ copy still blocked — Lee-Ann's `17.1 FAQ.docx` has a corrupted zip central
  directory in Drive itself, needs her re-export.

## 4. Correction accepted mid-session — IA ownership

I initially presented the M4 golden's "Brad-approved 17-page merged IA" (which drops
`/national-show/contact` despite Lee-Ann's Drive having a real "18. Contact" folder with
content) as settled/approved without verifying that with Brad directly. **Brad disputed
having approved it.** Corrected model going forward, confirmed by Brad explicitly:

> "SAOC is the lead [on] IA... your just the nos-site builder"

This session (`nos-site`) builds/reconciles pages to whatever structure the SAOC-lead
session (`saoc-5e`, `menu-system-layout4` lane) finalizes. It does not decide IA/structure
unilaterally, and should not present another lane's internal working documents as
Brad-approved without checking.

## 5. Cross-session coordination log (this session ↔ `saoc-5e`)

1. Identity exchange: confirmed this session is `nos-site`/PR #4, not `nos-design`/PR #1.
2. brain.py self-test results exchanged — no conflict, confirmed env-local per §2.
3. Build-status exchange (six M4 routes, PR #4 blockers) — sent to `saoc-5e` on Brad's
   behalf per his "SAOC lead... will finalise the structure" instruction.
4. Received the lead's finalized National Show structure — first paste attempt referenced
   a file path in a **different repo** (`InunuNet/SAOC`, the harness/memory repo) than this
   one (`SaocNosSite`), which is why the initial fetch/verify attempt found nothing. Lead
   re-sent the full content inline.
5. **Reconciled: no conflicts.** The lead's finalized structure (Sheet-based:
   `1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo`, tab `Pages`) matches what's built on
   `nos-site` exactly — `wosa-conference` slug, Contact folded into site-level `/contact`
   (also matches this mission's own RS4 ruling), `sa-exhibitors` vs `exhibitors` split all
   confirmed. The ticket-router move (`/national-show/tickets` becoming an audience router
   + `/tickets/buy/*` + a PayFast callback update at
   `app/api/tickets/checkout/route.ts:807-808`) is explicitly the lead's scope, not this
   session's — noted, not built.

## 6. Brad's closing concern — UNRESOLVED, for morning triage

Brad's instruction, verbatim reason for this wrap-up: *"SOEC lead diverged off onto
building a whole multitude of things that were out of scope for this session."*

Evidence gathered but **not investigated further** (per "stop, do no work"): during this
session, `origin/main` picked up 17 new commits, including what looks like a full Layout 4
menu system build — nav restructure (`ab4cae1e`), Sheet/drawer/header components
(`0b131c85`), font/typography fixes (`03d23a89`) — which reads as real feature
implementation, not just IA/structure finalization. Whether this is legitimate lead-lane
scope (menu system build was always understood to be theirs) or genuine scope creep beyond
what was agreed is **not adjudicated here** — flagged for Brad to triage in the morning
with full context on what `menu-system-layout4`'s actual mandate was.

## Bottom line for whoever picks this up next

- Do not treat any golden file's "Brad-approved" claim as settled without checking with
  Brad directly — this session got that wrong once already this session.
- Do not resume building until Brad's morning triage on the `menu-system-layout4` scope
  question above.

---

## ADDENDUM 2026-09-14/15 (late) — PR #4 UNBLOCKED, superseding the "do not merge" line above

Brad pushed back hard on this session re-reporting the `sanity/lib/fetch.ts` bug as a
standing blocker instead of fixing it — verbatim: *"You literally made a little baby girl's
blocker... could have just handed it over and kept going."* Fair: the fix design was already
written out in this same doc's §3/§6 history from the prior session; it just hadn't been
dispatched. It has now.

**What changed:**
- Dispatched a `general-purpose` agent as `Dev_Son5_M4-F24_NationalShowIaAlignment` (the
  named `@architect`/`@dev`/`@qa`/`@docs`/`@maintainer` subagent types were unavailable this
  session — see this session's `ListAgents`/`Agent` tool listing) with the exact scoped fix:
  an opt-in `propagateErrors` flag on `sanityFetch()` (`sanity/lib/fetch.ts`), default
  `false`/unset and byte-identical to prior behavior for the other ~29 callers repo-wide;
  only `lib/data/show-pages.ts`'s `loadShowPageOrFallback` dependency chain
  (`loadShowPage`, `loadShowPageSettings`) sets it `true`. `loadAllShowPages` and every
  other caller are untouched.
- Independently re-verified the diff myself before trusting the agent's report (`git diff`,
  re-ran `tsc --noEmit`, grepped repo-wide for `propagateErrors` to confirm exactly two call
  sites, both inside the intended path).
- Ran Codex GPT-5.5 review **twice**: `codex_qa.sh` at its hardcoded medium effort (PASS),
  then manually at `-c model_reasoning_effort=high` per the documented gate — Athanor#1438
  means a medium-only PASS is suspect on its own. High-effort pass independently re-derived
  the caller graph rather than trusting the diff text, and also passed. No findings either
  way.
- Committed as `d15715fe` (the fix, own commit per the standing "land fetch.ts separately"
  instruction from §3 above) plus `93694bbe`/`12812dff` (this session's own earlier memory
  docs, which had been sitting uncommitted).
- Fetched `origin/main` (had moved 17 commits from the `menu-system-layout4` lane since this
  session last checked) and resolved **all 7** previously-blocking merge conflicts via
  `git merge origin/main --no-edit`: `backlog.md` (2 separate conflict blocks), `learned.md`,
  `needs-human.md`, `reboot.md`, `.agent/memory/project/missions/active.json`,
  `.agent/memory/project/handoff/SESSION_STATE.md`, `.claude/settings.json`. All were
  memory/config files as the PR body already disclosed — no source conflicts. Every conflict
  was either purely additive (append-only logs — kept both sides' content) or a
  machine-generated single-pointer file where one side was already known-stale (`active.json`,
  `SESSION_STATE.md` — took `main`'s, since ours was frozen at the same stale M1/F1 checkpoint
  this doc's §3 already flagged).
- `pnpm install` (merge pulled in new `@playwright/test` e2e specs not yet installed locally),
  `tsc --noEmit` clean, `pnpm lint` clean (0 errors, only pre-existing unrelated warnings), no
  stray `<<<<<<<`/`=======`/`>>>>>>>` markers anywhere in the tree.
- Committed the merge as `75c525e6`, pushed to `origin/nos-site` (`339d5f8e..75c525e6`).
- **Verified via `gh api repos/InunuNet/SAOC/pulls/4`: `mergeable` flipped from
  `CONFLICTING`/`false` to `true`.** `mergeable_state` is `"blocked"` only on in-progress CI
  checks (`ci`, `dataset-residue-guard`, `firestore-residue-guard`) and the absence of a
  review — not a real blocker. This session does **not** self-merge, per the standing rule in
  this same plan file's "STANDING RULES" section (own branch → PR → cross-lane review → one
  approval → merge). Notified `saoc-5e` it's ready for review.
- Updated `backlog.md`'s `sanity/lib/fetch.ts` entry from "P1, still open" to "FIXED on
  `nos-site`, not yet on `main` until PR #4 merges."

**Superseded from the original wrap-up above:** "Do not merge PR #4 until `sanity/lib/fetch.ts`
is fixed and the 7 conflicts are resolved" — both are now done. What's left is CI + review,
not more engineering work on this branch.

**Lesson for next time, recorded in `learned.md` too:** when a concrete, already-designed fix
exists and a blocker keeps getting re-reported instead of dispatched, dispatch it. Re-stating
a known blocker a second or third time without acting on an available fix reads as stalling,
not caution.
