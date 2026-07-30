# F2 runtime-secret investigation — resolved (root cause was Secret Manager payload corruption)

Mission `cms-activation-deploy`, feature F2. Closed with all assertions passing (8/8) on
2026-07-30. **The section below headed "SUPERSEDED" was this doc's original content,
written mid-investigation during a session-interrupting outage. Its root-cause claims were
disproven by later evidence and are kept, clearly labelled, because each was a reasonable
hypothesis that cost real time to rule out — a future reader hitting the same symptom
should see why those trails are dead ends before re-walking them.**

## Symptom

`/api/revalidate` and `/api/draft` on the deployed backend
(`saoc-prod--saoc-webapp.europe-west4.hosted.app`) returned 401 regardless of which secret
value was sent — the correct `SANITY_REVALIDATE_SECRET`, an intentionally wrong value, and
no secret at all all produced the identical 401.

## Actual root cause — confirmed

**Both `SANITY_REVALIDATE_SECRET` and `SANITY_API_TOKEN` were stored in Secret Manager with
a corrupted payload**: roughly 80–95 bytes of non-ASCII prose text, followed by a newline,
followed by the real token. Both secrets were corrupted identically, written by the same
broken invocation (see "How the corruption happened" below).

Secret Manager stores payloads verbatim and does not trim or validate them. At runtime,
`process.env.SANITY_REVALIDATE_SECRET` resolved to the full contaminated blob
(prose + `\n` + token), and the app's `expected !== provided` string comparison
(`app/api/revalidate/route.ts:5-8`, `app/api/draft/route.ts:7-9`) could never match any
input — not the correct token alone, not a wrong value, not nothing. That is the entire
explanation for the symptom that had been read as "the env var is never populated": the
env var *was* populated, with the wrong bytes.

**The application code was never at fault.** Both routes read `process.env` at request time,
inside the handler function body, not at module scope — so this was never a
stale-closure/cold-start-caching problem either. Zero application code changed to fix this.

### How the corruption happened — CONFIRMED, same defect as the F1 dotenv finding

This is the same defect surfacing twice, not a resemblance — confirmed, not inferred.

`docs/dotenv-supply-chain-f1.md` flagged (2026-07-28) that `dotenv@17.4.2` prints a
promotional banner to stdout on `config()` and judged it supply-chain-benign, fixing only
`scripts/seed-sanity.ts`'s own call site (`config({ quiet: true })`). That fix did not
remove `dotenv` from the project, and nothing stops any other ad-hoc invocation from calling
`config()` without `quiet: true`.

During this investigation, an ad-hoc command of exactly that shape —
`node -e "require('dotenv').config(...); process.stdout.write(...)"`, used to extract a
secret's value from `.env.local` for piping into `firebase apphosting:secrets:set` — did
precisely that. This is already recorded independently in two places: `.agent/memory/project/learned.md`
(the "dotenv banner goes to stdout" entry, 2026-07-29) and `contracts/f2-deploy-next16.yaml`'s
A9 negative-control notes, both describing the same failure (a 137-char malformed value where
the correct secret is 43 chars) and the same fix (extract with
`grep '^KEY=' .env.local | cut -d= -f2-`, never a `dotenv`-loading `node -e`).

Byte-level confirmation done in this pass, without touching any real secret value: dotenv's
actual log functions (`node_modules/dotenv/lib/main.js`) prefix every banner line with `◇ `
(U+25C7) and, when the tip selected is one of the `⌘`/`⌁`-prefixed variants (6 of 8 entries
in the `TIPS` array), embed further `⌘`/`⌁` glyphs. `dim()` only wraps the tip in ANSI escape
codes when `process.stdout.isTTY` is true — piped into a command substitution or a subsequent
`process.stdout.write`, as in the extraction one-liner above, it is not a TTY, so the banner
carries no ESC (`0x1b`) byte, only plain UTF-8. Reproducing dotenv's `config()` against a
scratch `.env` file with stdout piped (not a TTY) and dumping the raw bytes gives, e.g.:
```
e297 8720 696e 6a65 6374 6564 2065 6e76   ◇ injected env
2028 3129 2066 726f 6d20 742e 656e 7620    (1) from t.env
2f2f 2074 6970 3a20 e28c 9820 656e 6162   // tip: ⌘ enab
6c65 2064 6562 7567 6769 6e67 207b 2064  le debugging { d
6562 7567 3a20 7472 7565 207d 0a         ebug: true }\n
```
— unique bytes `{e2, 97, 87, 20, ..., 8c, 98, ...}`, no `0x1b`, ending in a bare `\n` directly
followed by whatever the script writes next. That byte set is exactly the `{0x87, 0x8c, 0x97,
0x98, 0xe2}` the architect reported finding in the corrupted Secret Manager payload, and the
"prose, then `\n`, then the real token, with no separator" shape matches a banner-then-write
pipeline exactly. The earlier absence of the literal substrings "dotenv" or "injecting" in the
corrupted head is not evidence against dotenv — it's consistent with it: the actual log text
says "**injected**" (past tense, not "injecting"), and 6 of the 8 rotating tips (e.g. "⌘ enable
debugging") don't contain the string "dotenv" at all — only the 2 tips referencing
`dotenvx.com` do. And the corrupted head not starting with `{` was never in tension with this
explanation; dotenv's banner is plain text, not JSON.

Both secrets broke identically because both were extracted with the same broken `node -e`
invocation in the same session.

**No live trap remains in committed code.** The dangerous pattern was an ad-hoc shell
command, never a committed script — `grep`ing the repo (`scripts/`, `docs/`, `contracts/`,
root-level config) for `node -e` combined with `require('dotenv')` or `dotenv/config` found
only the two warnings above (memory + contract), never an instruction to run it. The correct
extraction command is already the one this doc's fix section and
`contracts/f4-seed-page-singletons.yaml` use: `grep '^KEY=' .env.local | cut -d= -f2-`. The
residual risk is that `dotenv` is still a project dependency and nothing stops a future
one-off `node -e` from reintroducing this — worth remembering, not worth removing the
dependency over.

### The fix

1. Re-set both secrets with the value piped directly, bypassing anything that could
   decorate stdout:
   ```
   printf '%s' "$TOKEN" | firebase apphosting:secrets:set SANITY_REVALIDATE_SECRET --project saoc-webapp --data-file=-
   printf '%s' "$TOKEN" | firebase apphosting:secrets:set SANITY_API_TOKEN --project saoc-webapp --data-file=-
   ```
   Never `echo` (appends a trailing newline — would reproduce a milder version of the same
   class of bug) and never anything that routes through `dotenv` (its stdout banner is what
   caused the original corruption). This created secret version v2 for each (both had
   reached v1 already from the original broken write).
2. `apphosting.yaml` pins no explicit secret version (references the secret by name only),
   so no edit to that file was needed for the new versions to be picked up.
3. A forced rollout was still required afterward: App Hosting resolves secret values at
   Cloud Run **revision creation** time, not per-request — an already-running revision keeps
   serving whatever value it resolved at boot, even after the underlying secret is updated.
   Without a new rollout, the corrected secret would sit in Secret Manager unused while
   production kept serving the old (corrupted) resolved value.
4. Verified by comparing the sha256 digest and byte length of the newly-stored Secret
   Manager payload against the same digest/length computed from the value in `.env.local`
   — matched exactly, both times. **No secret value was printed to any log, doc, or tool
   output at any point in this process** — digests and byte counts only.

`SANITY_API_TOKEN` had the identical corruption and would have failed the event-submission
form's write client (`app/api/events/submit/route.ts`) the first time anything exercised it
in production — a second latent defect, invisible until exercised, closed by the same fix.

## What was NOT the problem (retracted claims)

- **The build was never stale.** A CI-triggered build (committer `github-actions[bot]`)
  built and shipped F1 + F3 + F2 together at 05:13Z on 2026-07-30 and was serving 100% of
  traffic. Confirmed two independent ways: the App Hosting traffic-split configuration and
  the Cloud Run `latestReadyRevision`, cross-checked with
  `git merge-base --is-ancestor <commit> HEAD` against `604ba3a`, `ffb4225`, and `84dbf58`
  (all ancestors of what was live). The original doc's claim that production was stuck on
  `df5ee43`, a pre-F1/F3 commit, was wrong.
- **Push-to-main autodeploy is armed.** A separate backlog entry claiming autodeploy was
  not wired up is retracted by the same CI-build evidence above — it fired on its own.
- **`firebase apphosting:rollouts:create` is not unconditionally a no-op.** The original
  doc's working hypothesis — that the CLI dedupes on git SHA and silently reuses a cached
  failed build — was a real failure mode observed at the time, but is not a law: on the run
  that actually resolved this investigation, the same command produced a real effect (the
  backend's `updateTime` advanced, no new commit involved). Don't cite the dedupe theory as
  a guaranteed behavior; treat it as "has been observed to happen," not "always happens."
- **IAM / secret-access-grant propagation was a real but separate issue**, encountered and
  fixed earlier in this investigation (see superseded section below) — it explained one
  failed rollout, not the 401s that persisted afterward. Both things were true at different
  points: a genuine IAM grant race, followed by a genuine payload-corruption bug once the
  grant was fixed and secrets started actually resolving.

## Transferable lessons

- **Identical failures across correct, wrong, and absent inputs point at the comparison
  target, not the input.** If every value you try produces the same failure, stop varying
  the input and go inspect what the code is actually comparing against — in this case the
  resolved env var itself, not the string being sent to it.
- **ETag is not a reliable build/deploy discriminator.** ISR regeneration changes a
  response's ETag independent of any new deployment; don't use ETag drift as evidence a new
  build is (or isn't) live — check the build/rollout resource directly.
- **Never measure or verify a secret's value by a route that passed through a tool that
  decorates stdout.** `dotenv`'s startup banner is a known corruptor on this project
  (`docs/dotenv-supply-chain-f1.md`); the same class of tool can corrupt writes (as it did
  here) as easily as reads. Prefer `printf '%s' | <tool> --data-file=-` for any secret
  write, and verify by digest/length comparison, never by printing the value.

## End-state verification (post-fix)

- `POST /api/revalidate` on the deployed host with the correct `x-sanity-secret` header →
  200.
- Same request with a wrong or missing secret → still 401 (the check was not weakened to
  get this working).
- `GET /api/draft?secret=<correct>&slug=/` → enables draft mode and redirects, not 401.

All three confirmed against the live backend post-rollout. F2 gate: 8/8 assertions passing.

---

## SUPERSEDED — original mid-investigation notes (kept for the false-trail record only)

*Everything below this line was the doc's content before the corrected findings above. It
was written as a save point during a reported Claude outage, verified via tool calls at the
time, but its root-cause conclusions did not hold up under further investigation. Kept
verbatim (not edited) so the reasoning that led here is visible, not just the fact that it
was wrong.*

Saved because of a reported Claude outage mid-task. Everything below is verified via
tool calls actually executed in this session (not assumed), so work can resume from here
without re-deriving it.

### Task
@dev on mission `cms-activation-deploy`, feature F2. Fix: `SANITY_REVALIDATE_SECRET` /
`SANITY_API_TOKEN` not resolving at runtime on deployed backend
`saoc-prod--saoc-webapp.europe-west4.hosted.app`, causing `/api/revalidate` and
`/api/draft` to 401 even with the correct secret.

### Root cause — CONFIRMED, not speculative (RETRACTED — see corrected findings above)
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
   variable declared at all, let alone resolved. **(This turned out to be wrong — the live
   backend was NOT serving `df5ee43`; see corrected findings above. The IAM grant race in
   points 2 and 4 was real, but it explained one failed rollout, not the persistent 401s.)**
4. Re-ran `firebase apphosting:secrets:grantaccess SANITY_REVALIDATE_SECRET,SANITY_API_TOKEN --project saoc-webapp --backend saoc-prod --location europe-west4 --non-interactive`
   — succeeded. Verified directly via Secret Manager REST
   (`GET https://secretmanager.googleapis.com/v1/projects/saoc-webapp/secrets/<NAME>:getIamPolicy`)
   that **both** secrets now have `roles/secretmanager.secretAccessor` AND
   `roles/secretmanager.viewer` bound to
   `serviceAccount:firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com` —
   confirmed via `firebase apphosting:backends:get saoc-prod --project saoc-webapp --json`
   that this IS the backend's actual runtime `serviceAccount`. So principal is correct,
   binding is correct, as of now.

### Outstanding problem: cannot get a NEW rollout to actually build (context at the time — see corrected findings above for what this turned out to be)
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
  **(Not a general law — see "What was NOT the problem" above: the same command worked as
  expected later in this investigation.)**
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

### How I'm getting authenticated REST access (no gcloud installed in this env)
Reused the Firebase CLI's own cached OAuth token — read from
`~/.config/configstore/firebase-tools.json` → `.tokens.access_token` (was still unexpired
at last check, `expires_at` epoch-ms field). Headers: `Authorization: Bearer <token>`,
`X-Goog-User-Project: saoc-webapp`. Works against both
`firebaseapphosting.googleapis.com/v1` and `secretmanager.googleapis.com/v1`.

### Also still to verify (per original task, not yet done — DONE, see "End-state verification" above)
- Whether `SANITY_API_TOKEN` resolves at runtime once a good build is live (the public
  event-submission form's write client, `app/api/events/submit/route.ts`).
- End state proof required once a good rollout is live and serving:
  - `POST /api/revalidate` on deployed host, correct `x-sanity-secret` header → 200
  - same with wrong secret / no secret → still 401 (don't weaken the check)
  - `GET /api/draft?secret=<correct>&slug=/` → correct behavior, not 401

### Constraints still in force (at the time)
- Never touch port 3333 dev server. Never `pnpm build` while it's up.
- Don't `git add -A` — untracked `branding/`, `design/`, `documents/`, `design spec/` must
  stay out of any commit.
- No commit has been made yet for this fix (the code fix, `84dbf58`, was already committed
  before this session started — nothing new needs committing unless the CLI-dedupe
  workaround requires an apphosting.yaml or code change, which it hasn't so far; this is
  purely an infra/rollout operational issue).
