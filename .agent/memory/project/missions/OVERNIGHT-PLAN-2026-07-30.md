# Overnight plan — 2026-07-30, unattended

**No new mission.** `cms-activation-deploy` is still the right mission; 4 of its 6 features
are work I can do without Brad. Autonomy set to `high`. Deploy authorization is standing
(site is pre-production).

Resume with `python3 execution/mission.py resume`.

## Order of work

### 1. F2 — finish the runtime-secret failure (highest value, unblocks F6)

Start from `docs/f2-secret-runtime-investigation.md` — 92 lines of already-verified facts.
Do not re-derive them.

Known: `apphosting.yaml` correctly declares both secrets as `availability: [RUNTIME]`; IAM is
confirmed granted to `firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com`;
rollout `rollout-2026-07-29-002` for commit `84dbf58` FAILED with "Error resolving secret
version … grant your App Hosting backend access"; `firebase apphosting:rollouts:create`
reports success while creating no build (appears to dedupe on git SHA); @dev forced
`build-manual-1785355696` via the REST builds endpoint and never polled it.

**First resolve the contradiction** (recorded in backlog): @dev's build-resource inspection
says prod serves pre-F3 commit `df5ee43`, but `/studio/structure/homePage` renders F3's
pinned editor live, which that build cannot produce. Settle it with a decisive test — e.g.
a fingerprint that only exists in the new build — rather than trusting either inference.
Note ETag is NOT a build discriminator; ISR regeneration changes it.

**Definition of done:** on the deployed host, `POST /api/revalidate` with the correct
`x-sanity-secret` returns **200**, and still **401** with a wrong or absent secret. Do not
weaken the check to make it pass. Then re-run the full f2 gate and close F2.

Then add a **positive-path assertion** to the contract — the six green assertions missed
this defect entirely because every one tested only the negative path.

### 2. F4 — seed the six page singletons

`docs/f6-page-singletons.md` has the field-by-field mapping. Migrate the copy already
hardcoded in the components; **do not invent content**. All six types currently have 0
documents and F3's pinning is live, so IDs are fixed and deterministic. Dataset is
placeholder data on a pre-production site — safe. Use `SANITY_API_TOKEN` (Editor).
`membersPage` stays an empty placeholder by Brad's decision.

Then fix `docs/secretary-cms-guide.md` sections 7 and 12, which currently tell the secretary
to open documents that do not exist.

### 3. F5 — event slugs only

0 of 18 `societyEvent` docs have a slug, which is why `/events/[slug]` could not be
live-verified. Generate slugs mechanically from event titles.

**`hostSociety` is DEFERRED — needs Brad.** Assigning which society runs which event is
domain knowledge, not something to guess. Do the slugs, re-run the route checks, and report
how many of the 3 previously-unverifiable routes now render.

### 4. F6 — prove the loop end-to-end (only if F2 lands)

Edit a field in the deployed Studio, publish, confirm it appears on the deployed site.
Auth via `SANITY_API_TOKEN` injected into `localStorage['__studio_auth_token_26yfbug4']` as
`JSON.stringify({token, authenticated:true})` — proven working by @architect. Prefer a
throwaway document over mutating real content.

### 5. Backlog, if time remains

- Fix `check-new-document-filter.mjs:17` — asserts on synthetic `'event'`, real type is
  `societyEvent`, so it never exercises the real name.
- Investigate why push to `main` does not trigger an App Hosting build (continuous
  deployment appears unarmed). This blocks future unattended deploys.

## Blocked on Brad — do not attempt

- **Resend email** — needs `saoc.co.za` DNS, which is not ours yet. No sending domain can be
  verified. Do not sign up for anything.
- **Credential rotation** — `FIREBASE_ADMIN_PRIVATE_KEY` (leaked to transcript) and
  `SANITY_REVALIDATE_SECRET` (visible in screenshots). Console actions.
- **`hostSociety` assignment**, National Show content, Judge-directory scope.
- Anything requiring an interactive login.

## Standing constraints

- Dev server on port **3333** is Brad's — never kill or restart it, no `pkill`. Never run
  `pnpm build` while it is up (shared `.next`).
- Never modify Sanity CORS. `rm -rf` is blocked — use `find <dir> -mindepth 1 -delete`.
- Serialise tree-mutating agents; stand agents down when idle.
- Nothing durable in `.agent/memory/scratch/` — `brain.py wrap-up` deletes it at mission close.
- Never `git add -A` — `branding/`, `design/`, `documents/` must never be staged.
- Extract secrets with `grep '^KEY=' .env.local | cut -d= -f2-`; the dotenv banner pollutes
  stdout and produced a malformed header once already.
- A green gate is not a working feature. Every contract needs a positive-path assertion.
