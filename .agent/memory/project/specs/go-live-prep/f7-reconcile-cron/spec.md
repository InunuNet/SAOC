# F7 -- Reconcile cron, engineering half (go-live-prep, M3)

Status: SPEC ONLY. Nothing here has been run. No change to apphosting.yaml, no secret created,
no job created. Base: origin/main d7838cae. Author: @architect, 2026-11-02.
Scope per Brad 2026-11-02: security and technical strength, no copy change, no new user-visible text.
The alert email template (`emails/ReconciliationAlert.tsx`) is untouched.

## 1. Where things stand (verified on main)

- `POST /api/admin/reconcile-orders` exists and works as documented in `docs/order-reconciliation.md`. It fails closed with 401 when `RECONCILIATION_CRON_SECRET` is unset.
- `apphosting.yaml` has NO entry for `RECONCILIATION_CRON_SECRET` (nor `RECONCILIATION_ALERT_EMAIL`). In the deployed backend the secret is therefore unset, so any scheduler job pointed at the route would receive a permanent 401 and nothing would ever be reconciled. This is the single engineering gap.
- `proxy.ts` already lists `/api/admin/reconcile-orders` in its Basic Auth exempt set (the beta password wall will not block the scheduler), and the route does its own bearer auth rather than the admin session.
- `firestore.indexes.json` already carries the `orders(status, expiresAt)` composite index and is wired in `firebase.json`. Its deployed state must be confirmed READY (section 6).
- Route response contract: 200 clean; 207 when the alert email sent but a `reconciliationAlertedAt` stamp failed (`alertBookkeepingFailed` non-empty); 502 when the alert email failed to send (nothing stamped, next run retries); 500 when detection failed; 401 on auth failure. The no-stranded early return already includes `alertBookkeepingFailed: []`, so the paragraph "Known inconsistency, decision already made, not yet implemented" in `docs/order-reconciliation.md` is stale and belongs in the @docs pass.

## 2. Binding the secret in apphosting.yaml

Add, in the existing env list (the repo's established shape for Secret Manager values, same as `RECOVERY_TOKEN_SECRET`):

    - variable: RECONCILIATION_CRON_SECRET
      secret: RECONCILIATION_CRON_SECRET
      availability:
        - RUNTIME

Rules:
- RUNTIME only. A BUILD entry would bake the value into the bundle.
- Never a `value:` literal. A contract check (section 8) greps for that.
- `RECONCILIATION_ALERT_EMAIL` is optional and defaults to `info@saoc.co.za` in `lib/reconciliation.ts`. ASSUMPTION: leave the default, add no entry. If Brad wants alerts elsewhere it is a non-secret `value:` entry, RUNTIME, added in the same change. The default lands alerts in the council's shared info mailbox, the intended human reviewer today.

ORDERING IS LOAD-BEARING. An App Hosting rollout fails if a bound secret does not exist or the backend's service account cannot read it, and that would block the deploy of the entire site, not just this feature. So:
1. Secret created in Secret Manager and access granted to the App Hosting backend (Brad-only, section 5).
2. Only then merge and roll out the apphosting.yaml change.
The engineering PR is therefore prepared but held until Brad confirms step 1.

Secret value requirements (for the person creating it): at least 32 random bytes from a CSPRNG, stored with NO trailing newline. The route compares `Buffer.from(secret)` byte for byte against the trimmed header token, so a secret stored with a trailing newline can never match and the job would 401 forever. This is the same class as the logged secret-corruption incidents (`docs/secret-corruption-incidents.md`): the only acceptable proof is an authenticated probe after rollout (section 6, step 5).

## 3. Cloud Scheduler job definition

One job, not one per environment. Beta and production are the same backend and the same Firestore project (`saoc-webapp`, `.firebaserc`); there is no second data set to reconcile. Only the hostname varies by environment.

| Field | Value | Reason |
|---|---|---|
| Name | `saoc-reconcile-orders` | |
| Project / location | `saoc-webapp` / `europe-west4` | same region as the hosting backend (`firebase.json` frameworksBackend) |
| Target | HTTP, `POST` | the route exports only POST |
| URL, now | `https://beta.saoc.co.za/api/admin/reconcile-orders` | `SITE_URL` in apphosting.yaml; the custom domain, not a `*.hosted.app` origin (project rule: those origins do not appear in anything that may be copied around) |
| URL, after the apex DNS migration | `https://saoc.co.za/api/admin/reconcile-orders` | one `gcloud scheduler jobs update http` at cutover; add to the cutover checklist. Until then do NOT use the bare apex: its nameservers still point at the old host |
| Schedule | `7 * * * *`, time zone `Africa/Johannesburg` | hourly, off the top of the hour. Re-alert suppression is 6 h per order (`RE_ALERT_WINDOW_MS`), so hourly detection never means hourly emails for the same order |
| Authorization header | `Authorization: Bearer <RECONCILIATION_CRON_SECRET value>` | the only credential the route accepts. OIDC is not usable: the route reads the same `Authorization` header and the backend is publicly invokable |
| Attempt deadline | `180s` | detection plus one email plus batched writes |
| Retry | max 3 attempts, min backoff 30 s, max backoff 300 s, max doublings 3, max retry duration 600 s | covers transient 5xx and the 502 email failure. Safe: stamping happens only after a successful send, so a retry cannot double-stamp. Worst case is one duplicate alert email if a response is lost after the email sent (the route's own stated preference: a duplicate beats a dropped alert). A 401 burns the retries and fails, which is correct |
| Body | none | the route ignores the body |

Command shape (documented, NEVER run by an agent; the operator reads the secret from Secret Manager in their own shell and must not paste it into chat, a ticket or a file; the angle-bracket token below is a placeholder, not a value):

    gcloud scheduler jobs create http saoc-reconcile-orders \
      --project=saoc-webapp --location=europe-west4 \
      --schedule="7 * * * *" --time-zone="Africa/Johannesburg" \
      --uri="https://beta.saoc.co.za/api/admin/reconcile-orders" \
      --http-method=POST \
      --headers="Authorization=Bearer <value read from Secret Manager by the operator>" \
      --attempt-deadline=180s \
      --max-retry-attempts=3 --min-backoff=30s --max-backoff=300s \
      --max-doublings=3 --max-retry-duration=600s

Property to accept explicitly: the bearer value is stored inside the Scheduler job definition and is readable by any principal holding `cloudscheduler.jobs.get` on the project. Mitigation with no code change: only project owners hold it (do not grant Cloud Scheduler viewer or admin roles to other principals), and rotation (section 7) is a documented drill. Moving the check to OIDC needs a route change and is out of scope for go-live; recorded as a post-launch hardening option.

## 4. How failures alert (Scheduler cannot read the body)

Cloud Scheduler treats every 2xx, including 207, as success, and never looks at `alertBookkeepingFailed`. The docs "MUST READ" warning applies directly: alerting on non-2xx alone is blind to 207. The design uses request logs, not a route change, because 207 is the documented, tested contract and two sibling contracts pin it.

Three Cloud Monitoring alert policies, all notifying a channel Brad owns:

1. Partial failure (207): log-based alert on the backend's request logs, filter `httpRequest.requestUrl:"/api/admin/reconcile-orders" AND httpRequest.status=207`. Any single match alerts. Meaning: the email went out but a stamp did not commit; the order will re-alert sooner than 6 h.
2. Hard failure: log-based alert, same URL, `httpRequest.status>=400`. 401 means secret mismatch or corruption; 500 means detection failed (most often a missing index); 502 means the alert email could not be sent, so humans are NOT being told about stranded orders. Also a Scheduler-side policy: `resource.type="cloud_scheduler_job" AND resource.labels.job_id="saoc-reconcile-orders" AND severity>=ERROR`, which fires when all retries are exhausted or the request never reached the app.
3. Dead-man (absence): a log-based counter metric of `httpRequest.status=200` on the same URL, plus a metric-absence policy with a 3 h duration. Catches a paused or removed job, a disabled API, or a backend that stopped answering, none of which produce a 4xx or 5xx line.

Why not change the route to return a non-2xx on partial failure: it contradicts the shipped, gated 207 contract and the `reconcile-response-accuracy` goldens, and it would make Scheduler retry an already-sent email. The engineering half needs NO route change.

The notification channel and the policies are created by Brad (project-level, outbound email to people). Engineering supplies the exact filters above in the runbook; the policies themselves are not repo artefacts. The filters assume the App Hosting request logs carry `httpRequest.status` and `requestUrl`, which Cloud Run request logs do; step 7 of section 6 verifies this in Logs Explorer before relying on it.

## 5. Engineering versus Brad-only

Engineering (repo only, no production credentials; @dev under the normal chain):
- E1. Prepare the apphosting.yaml entry from section 2, held unmerged until B2.
- E2. Replace the "Infra: Cloud Scheduler wiring" paragraph in `docs/order-reconciliation.md` with the runbook from sections 2 to 7, and fix the stale "Known inconsistency" note. No secret values in any file.
- E3. The static contract from section 8, so a later edit cannot drop the binding or inline a value.
- E4. Add the job and the three alert policies to the apex-cutover checklist wherever it lives.

Brad-only (production credentials, Secret Manager and project infrastructure; an agent never runs these):
- B1. Create the secret: `firebase apphosting:secrets:set RECONCILIATION_CRON_SECRET --project saoc-webapp`. It prompts for the value without echo; supply a CSPRNG value with no trailing newline (`--data-file` is also available; check `--help` for stdin support). Let the CLI offer the grant, or run `firebase apphosting:secrets:grantaccess RECONCILIATION_CRON_SECRET --backend <backend id> --project saoc-webapp`.
- B2. Tell the orchestrator B1 is done; then E1 is merged and rolled out through the standing deploy route.
- B3. Run the ordering in section 6 (probe, create job, force-run).
- B4. Create the notification channel and the three policies from section 4.
- B5. Enable `cloudscheduler.googleapis.com` and `monitoring.googleapis.com` if not already on. Cloud Scheduler's first three jobs per billing account are free; this is one job.

Nothing in the engineering half touches live data, money state, or the alert email text.

## 6. Go-live sequence (must all be true before ticketing goes live on 1 Dec 2026)

In order. Steps 1 to 3 are preconditions; the job must not exist before step 5 passes.

1. Test data purged. The test-order purge (`scripts/ops/purge-test-data.mts`, go-live-prep F1, #175) has run against the live project at Brad's direction, so the first scheduled run does not email about every abandoned sandbox and E2E order. The four known stranded fixtures (`SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-7HHE9QN51RH4`, `SAOC-2027-G08QJQK278NY`, `SAOC-2027-R06HZ12P06EY`, see the open item in `docs/order-reconciliation.md`) must be gone or backfilled for the same reason. Sandbox-mode checkouts that strand after launch will alert like any other; that is correct.
2. Index confirmed: `firebase firestore:indexes --project saoc-webapp` shows `orders(status, expiresAt)` READY. Without it the route returns 500 "Detection failed".
3. Secret exists and access is granted (B1).
4. The apphosting.yaml binding is rolled out and the new revision is serving.
5. Authenticated probe, proving the stored value actually works (the lesson of the secret-corruption incidents). With zero stranded orders (step 1) a valid call is a safe no-op that sends no email:
   - no header returns 401 with body `Unauthorized`;
   - a wrong value returns 401;
   - the real value (read from Secret Manager in the operator's shell) returns 200 with `strandedCount` 0 and `alertBookkeepingFailed` empty.
   If the real value returns 401, suspect a trailing newline or a stale revision first.
6. Create the job (section 3), "Force run" it once from the console, confirm a 200 in the request logs.
7. In Logs Explorer confirm the section 4 filters match the step 5 and 6 requests (the 401s match the hard-failure filter, the 200 matches the dead-man counter), then send each policy's built-in test notification. A 207 cannot be provoked safely; its filter is verified by syntax and by the same fields, and that limit is accepted.
8. Alert recipient confirmed (default `info@saoc.co.za`, or an explicit `RECONCILIATION_ALERT_EMAIL`).
9. Known coverage gap acknowledged: the route reconciles the `orders` collection only. Vendor stand-payment attempts (`vendorStandOrders`, `docs/vendor-stand-payment-settlement.md`) are not covered and have their own settlement path. Recorded here, not fixed.

If any of 1 to 8 is not true on 1 Dec, ticketing can still go live, but stranded paid-but-unsettled orders will be silent. Say that plainly to Brad rather than treating it as a hard block.

## 7. Rotation and rollback

Rollback, fastest first. All reversible, none touches payment data (the route only ever writes `reconciliationAlertedAt`):
1. Stop traffic or noise: `gcloud scheduler jobs pause saoc-reconcile-orders --project=saoc-webapp --location=europe-west4`. Resume with `resume`.
2. Remove the job: the `gcloud scheduler jobs` removal subcommand against the same name, project and location.
3. Revert the apphosting.yaml entry and roll out. The route then fails closed with 401, which is harmless. Pause or remove the job first, or the section 4 policies fire on the 401s.
4. Disable the secret version only after step 3, never before: a bound secret that cannot be read fails the whole site's rollout.
5. Stamps already written (`reconciliationAlertedAt` on orders and positions) are inert for seat release (`stillHoldsSeat` does not read them); they only suppress a repeat alert for 6 h. No cleanup.

Rotation drill: pause the job, add a new secret version, roll out a new revision so the backend resolves it, repeat the step 5 probe with the new value, update the job header with `gcloud scheduler jobs update http saoc-reconcile-orders` plus the `--headers` flag, force-run, resume. Rotating without the pause produces 401 alerts for the gap between rollout and header update.

## 8. Contract for the engineering half (written when F7 is dispatched)

All offline, no network or credentials:
- C1. `apphosting.yaml` has an env entry with `variable: RECONCILIATION_CRON_SECRET`, `secret: RECONCILIATION_CRON_SECRET`, availability exactly RUNTIME (no BUILD), and no `value:` line inside that entry. Fails on main: the entry does not exist.
- C2. No tracked file contains a bearer value for this secret (scan of docs and apphosting.yaml for `Bearer ` followed by a non-placeholder token). Passes on main; regression guard.
- C3. `docs/order-reconciliation.md` contains the 207 body-check warning, the status-207 log filter, the dead-man policy, the secret-before-binding rule, the trailing-newline warning, and a rollback section. Fails on main: the infra paragraph is still the "infra step for whoever deploys this" stub.
- C4. `docs/order-reconciliation.md` no longer says the early-return `alertBookkeepingFailed` is "not yet applied". Fails on main.
- C5. `proxy.ts` still lists `/api/admin/reconcile-orders` in its exempt set and the route still fails closed on a missing secret before reading any header. Passes on main; regression guard.
The live steps (authenticated probe, forced job run, the three policies) are Brad-run in section 6 and cannot be contract assertions; the spec says so rather than faking them.

## 9. Assumptions made (no questions asked, per instruction)

- One job targeting the beta custom domain now, re-pointed at the apex cutover.
- Default alert recipient `info@saoc.co.za` stays.
- Alerting is via request-log policies, with no route change.
- Region `europe-west4` for the Scheduler job, matching the hosting backend.
- The bearer value lives in the job definition; OIDC is deferred.
- Missing monitoring at go-live is reported to Brad as a risk, not enforced as a block.
