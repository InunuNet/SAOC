# Draft Lane — fast local iteration (adopted 2026-10-08)

Brad, 2026-10-08: "we need a faster system for local dev work, I can't wait 15-20 minutes for each
small change". He adopted the draft lane the same day, verbatim: "adopt the draft lane".

## Scope

The draft lane covers **uncommitted local work that Brad is reviewing live on
http://localhost:3002**. It never covers a commit, a push or a deploy.

## How it works

1. **One persistent @dev per draft.** It's dispatched once and kept alive. Brad's small change
   requests are forwarded to it with SendMessage straight away. No re-dispatch, no fresh agent
   per tweak.
2. **No contract per tweak.** Brad's instruction is the spec while the draft is local. Quote it
   verbatim in the forwarded message. The no-invention rule (docs/rules/no-invention.md) still
   applies in full.
3. **The local dev server stays running** (`next dev` on :3002, hot reload, beta wall off via
   blank `BETA_BASIC_AUTH_*` in the launch env). Never run `pnpm build` while it's up, because it
   clobbers the dev server's `.next`.
4. **Screenshots come back after each change** (Playwright, 1280 and 320) so Brad doesn't have to
   hunt for the change.

## At approval ("approved", "push it", "ship to beta")

Brad confirmed a **LIGHT check** at approval (relayed by Athanor, shipped in harness v3.8.21) rather
than the full chain:

- `pnpm build` passes (stop the dev server first, or build in a separate copy);
- a screenshot of the approved state;
- one Codex review of the draft diff (`execution/codex_qa.sh`);
- then delete `.agent/DRAFT_LANE`, commit, push to beta, and verify the serving build.

Credentials, production config and floor files still go through `/spec`, whatever the lane.

## The switch

`.agent/DRAFT_LANE` is set by the operator: one line naming the draft and quoting the request.
Boot announces it as "DRAFT LANE ACTIVE: ...". A symlinked file is ignored. Agents never create it.

## Relation to workflow.md

`.claude/rules/workflow.md` (harness-synced) requires a contract before any @dev dispatch. This
project rule narrows that to commits and deploys for draft-lane work only. If the harness
contract-for-write hook blocks a draft-lane edit, the active mission's current feature needs a
contract file to exist (a lean skeleton is enough); see learned.md 2026-10-08.
