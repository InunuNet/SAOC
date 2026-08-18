# Golden: F1 — App Hosting auto-deploy health proof

## What "verified" means

Not "the build succeeded once, manually." The claim to prove is: **a push to `main`
alone, with no manual `firebase apphosting:...` invocation, produces a successful
Cloud Build that becomes what `saoc-prod` actually serves.**

**Revised 2026-08-18 (see mission notes, F1 golden-defect review).** This is a claim
about ONE commit's journey, proven in hindsight and permanently true once observed —
not a claim about whether HEAD is live this second. The pinned commit is `0c577dc`
(the tsconfig fix). Do not restate this as "the most recent automatic build is
healthy": App Hosting rolls out one build at a time, serially (~5-18 min each), and
commits land into this repo (ours, plus Athanor's own pushes) faster than that. A
check that requires "the CURRENTLY MOST RECENT automatic build is what's currently
served" reads red on a perfectly healthy pipeline for as long as anyone keeps
committing — it measures a liveness race against HEAD, not deploy health. Two live
runs on 2026-08-18 minutes apart demonstrated exactly this: proof build 028 vs.
serving 026, then proof build 029 vs. serving 027 — the queue was draining normally
both times, this was never a real failure.

The correct target is a single, stable commit's own build: did `0c577dc`'s automatic
Cloud Build get created (push-triggered, no manual rollout), reach SUCCESS, and get
served AT SOME POINT in the backend's rollout history — not necessarily right now.
"Served at some point" is what "push alone deploys to prod" actually requires; once
true it stays true regardless of what has shipped since. If a later commit re-broke
the tsconfig fix, that is a DIFFERENT, newer regression, not evidence that `0c577dc`
itself failed to deploy — and is out of scope for this specific historical proof.

## Reference facts (already true in the repo, confirmed by @architect before writing this)

- `tsconfig.json` `exclude` includes `functions` (was the root cause of every prior
  auto-deploy failure since the self-signup Cloud Function was added).
- `apphosting.yaml` declares `RECOVERY_TOKEN_SECRET`, `PAYFAST_SANDBOX_MERCHANT_ID`,
  `PAYFAST_SANDBOX_MERCHANT_KEY`, `PAYFAST_SANDBOX_PASSPHRASE`, `RESEND_API_KEY`,
  `RESEND_FROM_TICKETS`, `RESEND_FROM_FORMS` as Secret Manager-backed variables.
- Commit `0c577dc` is the fix commit. Any build associated with that commit SHA or later,
  auto-triggered (not manually started), that reaches SUCCESS is acceptable proof.

## Acceptance protocol (@qa runs this, not @dev, not the orchestrator)

1. Locate the automatic (push-triggered, not manual) Cloud Build whose source commit
   SHA is EXACTLY `0c577dc` (its own build, not "any build at or after it" — pin to
   this one commit's specific build so the proof stays stable regardless of how many
   commits land afterward).
2. Confirm that build's status:
   - `SUCCESS` → proof holds, continue to step 3.
   - `WORKING` / `QUEUED` (still in-flight) → not a failure. Record it as PENDING and
     re-run later; do not mark F1 failed while `0c577dc`'s own build has not yet
     reached a terminal state.
   - `FAILURE` / `TIMEOUT` / `CANCELLED` → real, still-open gap. Do not mark F1 done.
3. Search the backend's rollout HISTORY (not just the currently-active rollout) for
   one with `state = SUCCEEDED` whose `build` reference resolves, by build-id
   identity, to `0c577dc`'s own automatic build from step 1 — i.e. that exact build
   was actually served at some point. It does not need to be what's currently live;
   later commits superseding it in normal operation is expected and healthy, not a
   failure.
4. Behavioral cross-check: send (or find a recent real) ITN with a source IP that would
   have failed the OLD hard-reject IP check, and confirm Cloud Logging shows the NEW
   log line (`'Source IP not in resolved PayFast host set (logged only, not rejecting)'`)
   rather than the old rejection line — proof the LIVE code, not just local source, has
   the fix.
5. Record the build ID, commit SHA, and timestamp in the mission's Notes section.

## Failure mode

If no automatic build for commit `0c577dc` exists at all, or that specific build reached
a terminal FAILURE/TIMEOUT/CANCELLED state, or it reached SUCCESS but no rollout in the
backend's history ever served it, this is a real, still-open gap — do not mark F1 done.
Escalate as its own dev-fixable item (likely a Cloud Build trigger/config problem
distinct from the tsconfig fix already made). A build still in-flight (WORKING/QUEUED)
is NOT this failure mode — retry later instead of failing the gate.
