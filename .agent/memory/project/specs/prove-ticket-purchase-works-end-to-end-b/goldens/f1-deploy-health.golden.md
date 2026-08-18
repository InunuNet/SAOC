# Golden: F1 — App Hosting auto-deploy health proof

## What "verified" means

Not "the build succeeded once, manually." The claim to prove is: **a push to `main`
alone, with no manual `firebase apphosting:...` invocation, produces a successful
Cloud Build that becomes what `saoc-prod` actually serves.**

## Reference facts (already true in the repo, confirmed by @architect before writing this)

- `tsconfig.json` `exclude` includes `functions` (was the root cause of every prior
  auto-deploy failure since the self-signup Cloud Function was added).
- `apphosting.yaml` declares `RECOVERY_TOKEN_SECRET`, `PAYFAST_SANDBOX_MERCHANT_ID`,
  `PAYFAST_SANDBOX_MERCHANT_KEY`, `PAYFAST_SANDBOX_PASSPHRASE`, `RESEND_API_KEY`,
  `RESEND_FROM_TICKETS`, `RESEND_FROM_FORMS` as Secret Manager-backed variables.
- Commit `0c577dc` is the fix commit. Any build associated with that commit SHA or later,
  auto-triggered (not manually started), that reaches SUCCESS is acceptable proof.

## Acceptance protocol (@qa runs this, not @dev, not the orchestrator)

1. `gcloud builds list --region=<app-hosting-region> --limit=20` (or the Firebase
   console/App Hosting equivalent) — locate a build with:
   - trigger type = automatic (push-triggered), not manual
   - source commit SHA at or after `0c577dc`
   - status = SUCCESS
2. Confirm the deployed backend's active revision timestamp is at or after that build's
   completion time (i.e. it's actually serving, not just built).
3. Behavioral cross-check: send (or find a recent real) ITN with a source IP that would
   have failed the OLD hard-reject IP check, and confirm Cloud Logging shows the NEW
   log line (`'Source IP not in resolved PayFast host set (logged only, not rejecting)'`)
   rather than the old rejection line — proof the LIVE code, not just local source, has
   the fix.
4. Record the build ID, commit SHA, and timestamp in the mission's Notes section.

## Failure mode

If no auto-triggered build at/after `0c577dc` exists, or the most recent one FAILED, this
is a real, still-open gap — do not mark F1 done. Escalate as its own dev-fixable item
(likely a Cloud Build trigger/config problem distinct from the tsconfig fix already made).
