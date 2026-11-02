# Learned

Older lessons: `archive/learned-history.md`. Never read it whole; `grep -n -i <topic>` it or `brain.py recall`.

## Standing rules (Brad; newest wins)

**Lean operation (Brad, 2026-11-02, binds SAOC, NOS Site and NOS Design).** Missions are small, focused, provable, achievable and finished quickly. Clean context, clean directives, clear instructions. About 100k working context; reaching 300k means something went wrong. Self-compact after every committed feature (`execution/compact.py now`; mid-task `delay`, then `restore`). Never read `archive/*`, `learned.md` or `backlog.md` whole: grep, `tail -n 60`, or `brain.py recall`.

**Don't ask Brad technical questions.** Make the call, name the assumption, continue. He takes the recommendation on anything technical. Guards still stop you: list it as blocked and move on.

**Harness updates: always apply, never ask** (Brad, 2026-11-02). Commit them as their own commit.

**Check before you claim.** Codex quota was wrongly reported as out until 4 Nov without a check. Run the check first. Codex's working model is the default (`codex exec -s read-only`, `execution/codex_qa.sh`); `gpt-5.5` is rejected on this account.

**Live site.** "Don't change anything on the live site." "do not change the live site that Leanne is checking to confirm the content. It just confuses her". Any merge to main redeploys beta, so no merge until Lee-Ann has finished. "Just don't delete and fuck up my data, bro."

**Hard limits.** Ozow sandbox only. Never set SITE_PUBLIC_LAUNCH on anything deployed. Never flip TICKETING_PAYMENTS_LIVE. No force push. No `rm -rf`; use `execution/safe_delete.py`. Never print secrets; read `.env.local` only inside scripts. Purge `--apply` on live: Brad only.

**Content.** Lee-Ann's copy verbatim; copy freeze on; NOS home hero frozen; no invention (`docs/rules/no-invention.md`); no wild-orchid conservation content (WOSA).

**Comms.** WhatsApp is read-only, Lee-Ann's chat only, via `.tmp/sandbox/whatsapp/read_leeann.py`; never send. Concise replies. Never ask Brad for passwords. No crons; health checks on demand.

**Shell.** One plain command per Bash call; multi-step logic in scripts under `.tmp/sandbox/`. No `cd`. Nothing outside the project without permission. Never pass `model:` on Agent; name dispatches with `execution/dispatch_name.py`.

## Recent lessons

## conference-workshop-tickets M4/F6 close-out (2026-10-07)

- **Run the milestone gate BEFORE committing deployed-check manifests, never after.** A manifest
  must record the HEAD it was produced against; committing it first makes the recorded sha stale
  the instant the commit lands, forcing a redeploy and a real re-run (a fresh sandbox purchase,
  a fresh email) to get a manifest that actually matches HEAD. Never hand-edit `commit_sha` to
  paper over the gap — that falsifies the evidence the manifest exists to provide. Sequence:
  gate green against the deployed build → commit the manifests that proved it.
- A check that diffs page files against literal `HEAD` passes only while the work is still
  uncommitted, then false-FAILs the moment it's committed (HEAD moved past the compared state).
  Pin the diff base to the pre-feature commit and add a `git merge-base --is-ancestor` guard so
  the check fails loudly if its pinned base is ever wrong, instead of silently comparing against
  the wrong thing. Pattern: `contracts/checks/conference-workshop-tickets-f6/_render-unchanged.mjs`.
- When a `codex_qa` assertion's prompt embeds golden text inline, and the golden copy falls
  behind a ratified code change (an addendum that deliberately diverges from the original
  golden), Codex keeps failing the same non-defect round after round — it's grading against
  stale truth. Whenever an addendum ratifies a divergence from a golden file, sweep the golden
  body AND any `codex_qa` prompt that embeds it in the same pass, not just the code.
- A view-model that displays counts or prices must read from the same live sources and
  functions checkout uses — `resolveEffectivePrice()`, `effectiveCapacity()` over live Sanity
  fields — never a static provisional-figures table. Codex caught three such desyncs in F6
  (view-model and checkout silently drifting against the same product over time).
- A fixture/stub that ignores `slug` (one stub serves every product) hides coupling bugs once
  the real code branches on per-product live fields. Make stubs slug-aware and mirror real data
  shape, not a single generic shape reused for every product.
- When a fix is reported as done before its regression check exists, prove the check would
  actually have caught the bug by running it against a deliberately-reintroduced mutant of the
  defect (the A31/A32/A34 pattern) — a check that would pass against both the buggy and fixed
  code is not a regression check, it's decoration.

- 2026-10-08 — DRAFT LANE adopted by Brad (docs/rules/draft-lane.md): uncommitted local work he reviews live on :3002 = one persistent @dev, tweaks forwarded via SendMessage with no per-tweak contract; full chain (contract/QA/Codex/docs/gate) runs once at approval before commit+beta. Gotcha: require_contract_for_write.sh is path-independent — it blocks ALL non-memory/docs writes whenever the globally active mission's current feature has no contract file, even writes for unrelated drafts. Write a lean contract skeleton first.

- 2026-10-08 — ROLE SPLIT (Brad, verbatim via saoc-nos-site-e3): "Let NOS Design do the design... Copy will come from Lee-Ann and will be in the google drive folder https://drive.google.com/drive/folders/1O2Lbzsbt57i8-7ZLFdhrcHjaMQ--TkJH NOS Does design you create structure bring in the copy as it lands. SAOC is the lead and builds the SAOC site, I'll likly add an SAOC Design as well...". So: NOS Design (saoc-nos-design-f1) designs NOS; NOS Site (saoc-nos-site-e3) builds NOS structure + copy intake; SAOC (this repo/session) leads and builds the SAOC site. National-show page changes belong to NOS Site — do not edit app/(marketing)/national-show/** from SAOC drafts.


<!-- Merged 2026-10-19 by saoc-82: lines present only in the stale main working tree (feat/conference-workshop-tickets), appended verbatim in original order so nothing is lost. -->









































































































































































































































































































































































































































































































































































































































































































## 2026-10-13 — Test mail uses plus-addressing
Test and notification emails sent to Brad go to brad+<saoc|nos>-<ticket|form|approve|check-in>@inunu.net, never bare brad@inunu.net. Gmail filters route them out of his primary inbox. When verifying with the gws read-only inbox check, search by the plus address (to:brad+nos-ticket@inunu.net), which also makes the check unambiguous. See rules.md.

## vendor-flow-fixes — Ozow lookup, browser, and Suspense lessons (2026-10-15)
- (2026-10-15) Ozow `GetTransactionByReference` response keys are camelCase in practice (`transactionReference`, `transactionId`, `status`, `amount`), despite the PascalCase docs. Read camelCase first with a Pascal fallback. If the same key arrives in both casings with different values, fail closed for the whole lookup. The notification's `IsTest` is not reliably lowercase `"true"`, so compare case-insensitively. Codex needed four rounds on this casing fix, and each finding was a real fail-closed gap: handle ambiguity in untrusted responses from the first draft.
- (2026-10-15) Diagnose Ozow settlement failures from App Hosting logs first (`[vendors/stand-payment]` and `[payments/ozow]` lines). Then probe the live API read-only with a node script that uses the sandbox env keys. Never print the keys.
- (2026-10-15) `pay.ozow.com` returns 403 to headless Chromium. Use Claude-in-Chrome in Canary, or headed Chrome. This is Brad's standing rule as of 2026-10-15 and supersedes the older project-wide Claude-in-Chrome ban recorded earlier in this file (the one citing a 606x667 resize floor). The 606x667 resize floor still applies, so a true 390px viewport check still needs headless Playwright.
- (2026-10-15) React 19 Suspense in a hidden or minimised window: the reveal waits on `requestAnimationFrame`, so content stays in `div#S:0[hidden]` and never hydrates. A browser test that reports "inputs dead" in that state is measuring the window, not the site. Bring the window to the foreground before judging interactivity.
- (2026-10-15) Baseline for `verify-show-page-m4`: the base FAIL set is 10 items: R2, R6, R7, RS3, CL4, V1–V5. Any run that differs from this set needs explaining before it counts as a regression.

## vendor-flow-fixes F7 — browser checks, worktree env, and contract goal text (2026-10-15)
- (2026-10-15) Architect-written browser checks hard-coded a count (15 apply checkboxes) without reading the source list, which has 14 (`lib/vendor-applications.ts`, from Lee-Ann's 26 Aug doc). Checks must derive counts from the source or be verified against base before dispatch.
- (2026-10-15) Worktree gates need `.env.local`. Symlink the main tree's `.env.local` into the worktree (it is gitignored) rather than copying it. Without it the build fails, and the dataset residue guard errors on the missing `NEXT_PUBLIC_SANITY_PROJECT_ID`.
- (2026-10-15) Browser-check ports must be env-overridable and set in the contract command (`VENDOR_P1_PORT=3517 SITE_PUBLIC_LAUNCH=true`). On the shared machine, another session's server held 3417 and answered 401 (basic auth), so the browser checks silently hit the wrong server.
- (2026-10-15) Contract goal text must match the golden, and the golden wins. Codex flagged a 42→44px button growth against a goal saying "without enlarging the visual box", while the golden prescribed `min-h-11`. Reconcile the goal text to the golden before dispatch.

## Questions for Lee-Ann doc — rules (Brad, 2026-10-29, after a 175-question doc became unusable)
- Every question is ONE short sentence that she can answer in a few words. No preamble, no "we will do X until you answer", and no explaining our process, AI, gates or design reasoning.
- Ask only what blocks the site or launch AND is not already answered in her Drive docs, her earlier answers in the doc, or the Copy Updates doc. Check all three before asking.
- Never ask about spelling or typos. Those go as anchored Word comments in her .docx, and the site shows her words verbatim.
- Never ask for content she already knows is missing ("send the copy for page X"). She tracks that herself.
- No duplicates, no "ignore question X" follow-ups, and no corrections of earlier questions. Fix the question instead.
- Remove answered and acted-on questions. The doc holds only what is open. Back up before every rewrite.
- Group under a few plain headings. Number 1..n fresh each cleanup; no running letters (aaaaa).
- During a COPY FREEZE nothing is added at all.
- Cap: at most 10–15 open questions in the doc at any time. Lifecycle: she answers, we act, we remove the question (and her answer) in the same pass. The doc is a short live queue, never an archive.

## 2026-10-29 — NOS home hero is FROZEN (Brad)
Brad, after approving the hero on the restore branch: "the hero is good dont change it again untill we get feedback from Lee-Ann". Hero = title "National Orchid Show", her Section 1 lede, Theme line under Dates/Venue (nos-hero-theme). No agent or session touches `app/(nos)/national-show/page.tsx` hero block, NosHero hub props, or `.nos-hero-*` rules in nos-theme.css until Lee-Ann's feedback is logged in Copy Updates. Checks and gates adapt to the hero, never the other way round.

## 2026-10-29 — Dev model is Sonnet 5.5, retries included (Brad)
Brad: "Why we using Opus for Dev work use Sonnet 5.5". The dispatch-naming retry ladder (sonnet5 → opus5 → fable5) does NOT apply to @dev on SAOC. Every @dev dispatch, first or retry, is `--model sonnet5` / Agent `model: sonnet`. A retry gets a sharper brief (the QA findings verbatim), not a bigger model. Same for @architect and @docs. QA stays cross-vendor (Codex) with the @qa-apex fallback only while Codex is unavailable.
Addendum (Brad, same day): "The Athanor harness has the agents predefined to lower token usage use it as intended when we run a mission." The `.claude/agents/*.md` frontmatter already fixes each role's model (dev/qa/architect/analyst/maintainer = sonnet, docs = haiku). NEVER pass `model:` on an Agent dispatch, and ignore `dispatch_name.py --retry` tier advice. The dispatch NAME still records the tier the definition gives (`--model sonnet5`, docs `haiku`).

## 2026-10-31 — ONE review address for Brad (Brad, angry: "Can we not standardize it so that I can always look at the right place?")
Brad never guesses a port. Anything for him to review runs at http://nos.localhost:3000/ (NOS) / http://localhost:3000/ (SAOC), password prompt off, Sanity fixture replay while the quota is out. Exactly one server on 3000 at a time: whoever puts new work up first stops the previous one, and tells Brad "3000 is updated", never a new port. Scratch servers for gates/checks use other ports and are never mentioned to him. Pattern script: .tmp/sandbox/nos-home-restore/dev-serve.sh (set -p 3000 and NEXT_PUBLIC_*_SITE_URL to :3000).

## 2026-10-31 — Lee-Ann approved the NOS home; Brad: "push the NOS Home page to firebase"
Approval covers design/nos-home-align @ 2563583f (restore + NOS Design align + Brad's rulings). The hero freeze stays (her feedback on the hero itself is not in yet); everything below the hero is approved as shown on 3000. Ship = gate updates per NOS Design's list, build, fallback QA, docs, PR, CI green, merge → beta auto-deploys. Stand-down lifted for this delivery only.

## 2026-11-01 — Firebase App Hosting builds take ~50-55 min, not 10
Measured: build 2e4026bf (20e62c45) ran 16:12→17:06Z; build b93611f9 (5a29e41c) was still BUILDING at 49 min. Watchers must allow 60+ min after a merge before calling a rollout stuck. The slow step is `scripts/generate-image-variants.mjs` + `next build` on the App Hosting builder. Backlog candidate: cache generated image variants (or commit them) to cut deploy time.

## 2026-11-02 — RULE: always self-compact to reduce context and save tokens
Brad, verbatim: "self compaction is important save it as a rule and always use it to reduce context and save tokens". Aim for about 100k working context, hard ceiling 300k (Athanor fleet notice, same day).
- After every committed feature or mission close-out with large context: `python3 execution/compact.py now`. Don't wait to be told.
- Mid-task: `python3 execution/compact.py delay`, then `python3 execution/compact.py restore` at the next safe point. `python3 execution/compact.py status` shows tokens and what is scheduled.
- Commit and wrap up properly first, so nothing is lost (2026-09-14 lesson above still holds).

