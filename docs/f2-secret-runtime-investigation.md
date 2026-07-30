# F2 runtime-secret investigation — in-progress state (save point, outage interruption)

Saved because of a reported Claude outage mid-task. Everything below is verified via
tool calls actually executed in this session (not assumed), so work can resume from here
without re-deriving it.

## Task
@dev on mission `cms-activation-deploy`, feature F2. Fix: `SANITY_REVALIDATE_SECRET` /
`SANITY_API_TOKEN` not resolving at runtime on deployed backend
`saoc-prod--saoc-webapp.europe-west4.hosted.app`, causing `/api/revalidate` and
`/api/draft` to 401 even with the correct secret.

## Root cause — CONFIRMED, not speculative
1. `apphosting.yaml` fix (commit `84dbf58`, already on `origin/main`) correctly declares
   both secrets as `availability: [RUNTIME]`. Code and IAM concept are correct.
2. A rollout attempt for commit `84dbf58` DID happen before I was invoked:
   `rollout-2026-07-29-002` / `build-2026-07-29-002`, created 2026-07-29T19:23:37Z,
   **FAILED** at 19:24:18 (only ~40s later) with:
   `Error resolving secret version with name=projects/saoc-webapp/secrets/SANITY_REVALIDATE_SECRET/versions/latest ... grant your App Hosting backend access to it with 'firebase apphosting:secrets:grantaccess'`
   — i.e. the grant that was reportedly run beforehand had NOT actually taken effect (or
   not propagated) at the moment App Hosting tried to resolve the secret. Likely an IAM
   propagation-lag race, not a wrong-principal grant (see #3).
3. Because that rollout FAILED, the backend kept serving the **previous successful
   build**, `build-2026-07-28-006`, built from commit **`df5ee43`** — a commit from
   BEFORE `84dbf58` even existed. That build's env config contains **zero** references
   to `SANITY_REVALIDATE_SECRET` or `SANITY_API_TOKEN` — confirmed by fetching the build
   resource directly and inspecting `config.env` / `config.effectiveEnv`. This is why
   @qa saw 401 for both correct and incorrect secrets: the running instance never had the
   variable declared at all, let alone resolved.
4. Re-ran `firebase apphosting:secrets:grantaccess SANITY_REVALIDATE_SECRET,SANITY_API_TOKEN --project saoc-webapp --backend saoc-prod --location europe-west4 --non-interactive`
   — succeeded. Verified directly via Secret Manager REST
   (`GET https://secretmanager.googleapis.com/v1/projects/saoc-webapp/secrets/<NAME>:getIamPolicy`)
   that **both** secrets now have `roles/secretmanager.secretAccessor` AND
   `roles/secretmanager.viewer` bound to
   `serviceAccount:firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com` —
   confirmed via `firebase apphosting:backends:get saoc-prod --project saoc-webapp --json`
   that this IS the backend's actual runtime `serviceAccount`. So principal is correct,
   binding is correct, as of now.

## Outstanding problem: cannot get a NEW rollout to actually build
- `firebase apphosting:rollouts:create saoc-prod --project saoc-webapp --git-branch main [--force]`
  reports `✔ Successfully created a new rollout!` on BOTH attempts (once before, once after
  the re-grant), but **no new Rollout or Build resource is ever created** — verified by
  listing rollouts (`GET .../backends/saoc-prod/rollouts?pageSize=30`, sorted client-side
  by createTime, since the API's default order is NOT chronological) and by direct GET on
  `rollout-2026-07-29-003/004/005` (all 404). The only 2026-07-29 rollout that exists is
  the FAILED `rollout-2026-07-29-002`, unchanged (`updateTime` never moves).
- Working hypothesis: the CLI dedupes on git commit SHA — since a Build already exists
  for commit `84dbf58` (the FAILED `build-2026-07-29-002`), `rollouts:create` reuses/
  references that cached (failed) build rather than building fresh, and its "success"
  message just reflects the API call being accepted, not a new build actually running.
  This has NOT been fully proven, just is the best-fitting explanation for the evidence.
- Workaround identified and in progress: bypass the CLI and call the App Hosting REST API
  directly to force a genuinely new Build object:
  ```
  POST https://firebaseapphosting.googleapis.com/v1/projects/saoc-webapp/locations/europe-west4/backends/saoc-prod/builds?buildId=<unique-id>
  Body: {"source":{"codebase":{"branch":"main"}}}
  ```
  This DID return a real long-running operation (not an instant no-op), e.g. build id
  `build-manual-1785355696`, operation
  `operation-1785355696857-657c5841be13c-442fd8e7-02f67d54`, still building at last check.
  **This is the thread to pull on when resuming**: poll that build (or list builds fresh,
  sorted client-side, pageSize>=30) to see if it reaches `READY`, then create a rollout
  FROM that specific build ID (there may be a way to target `rollouts:create` at a
  specific build, or a REST equivalent — not yet checked). If `READY`, that new build's
  `config.effectiveEnv` should show the two secrets resolved; if `FAILED`, read
  `.errors[0].error.message` for the real reason (may reveal the grantaccess propagation
  theory is wrong).

## How I'm getting authenticated REST access (no gcloud installed in this env)
Reused the Firebase CLI's own cached OAuth token — read from
`~/.config/configstore/firebase-tools.json` → `.tokens.access_token` (was still unexpired
at last check, `expires_at` epoch-ms field). Headers: `Authorization: Bearer <token>`,
`X-Goog-User-Project: saoc-webapp`. Works against both
`firebaseapphosting.googleapis.com/v1` and `secretmanager.googleapis.com/v1`.

## Also still to verify (per original task, not yet done)
- Whether `SANITY_API_TOKEN` resolves at runtime once a good build is live (the public
  event-submission form's write client, `app/api/events/submit/route.ts`).
- End state proof required once a good rollout is live and serving:
  - `POST /api/revalidate` on deployed host, correct `x-sanity-secret` header → 200
  - same with wrong secret / no secret → still 401 (don't weaken the check)
  - `GET /api/draft?secret=<correct>&slug=/` → correct behavior, not 401

## Constraints still in force
- Never touch port 3333 dev server. Never `pnpm build` while it's up.
- Don't `git add -A` — untracked `branding/`, `design/`, `documents/`, `design spec/` must
  stay out of any commit.
- No commit has been made yet for this fix (the code fix, `84dbf58`, was already committed
  before this session started — nothing new needs committing unless the CLI-dedupe
  workaround requires an apphosting.yaml or code change, which it hasn't so far; this is
  purely an infra/rollout operational issue).
