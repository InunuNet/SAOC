# build-without-secrets — what this contract is and is not

## The defect

The Firebase App Hosting deploy has been silently failing since early August
2026. Every push looked successful — CI (`.github/workflows/ci.yml`) was green
on every commit — but the deployed site kept serving the last good build
(`01dd63f`, 2026-07-30). `/tickets`, `/national-show/faq` and
`/national-show/plan-your-visit` all 404'd in production while returning 200
locally, because App Hosting never accepted a newer build.

A manual rollout (`firebase apphosting:rollouts:create saoc-prod -g 753758e -f`)
surfaced the real error:

```
Error occurred prerendering page "/tickets"
Error: Missing Firebase Admin credentials. Ensure FIREBASE_ADMIN_PROJECT_ID,
FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY are set.
```

`app/(marketing)/tickets/page.tsx` declares `export const revalidate = 60`,
which still prerenders the page at BUILD time. That prerender calls
`getSoldCountsByTicketType()` (`lib/data/tickets.ts`) whenever the live
`nationalShow.salesOpen` flag is `true` (it is, in the real dataset) — and that
function uses the Firebase Admin SDK. In `apphosting.yaml`,
`FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` and
`FIREBASE_ADMIN_PROJECT_ID` are all `RUNTIME`-only — correctly: sold counts are
live inventory, and baking them at build time would serve stale availability
and could oversell (see `apphosting.yaml`'s own `SITE_URL` comment block for
the project's established BUILD-vs-RUNTIME reasoning). So the builder has no
credentials and the build dies.

## Why local `pnpm build` could never catch this

Every local build reads `.env.local`, which supplies
`FIREBASE_ADMIN_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`. The build passes locally
100% of the time and fails remotely 100% of the time — the check (a local
build) was measuring something other than the thing that matters (a build with
only what the real builder has).

## Why CI passing was not evidence either — and never could have been

This is worse than "CI doesn't run the same build." CI's build genuinely
*attempts* to prerender `/tickets`, but it can never reach the failing code
path, for a reason unrelated to Admin credentials:

`.github/workflows/ci.yml` sets `NEXT_PUBLIC_SANITY_DATASET:
${{ secrets.NEXT_PUBLIC_SANITY_DATASET }}` — and that GitHub secret was never
created (`gh secret list` shows only `NEXT_PUBLIC_SANITY_PROJECT_ID` and
`SANITY_API_TOKEN`). GitHub Actions sets the env var to an **empty string**,
not "unset". `sanity/env.ts` does `process.env.NEXT_PUBLIC_SANITY_DATASET ??
'production'` — `??` only falls back on `null`/`undefined`, not on `""`. So in
CI, `dataset` is literally `""`, and every `sanityFetch` call throws
`` `dataset` must be provided to perform queries `` (visible verbatim in the CI
build log for run `31631045693`, e.g. around the `nationalShowSales` query).
`sanityFetch` catches that and returns `null`.

`app/(marketing)/tickets/page.tsx` only calls `getSoldCountsByTicketType()`
when `salesOpen === true`. With `salesState` null in CI, `salesOpen` evaluates
to `false`, and the Admin SDK call is **never reached** during the CI build.
The route still renders (with fallback copy), `/tickets` shows up as `○
Static` in the CI build's route table, and the job reports success —
having never executed the one line of code that breaks in production, where
the same query against the same dataset (reachable via CDN with no auth token
needed) genuinely returns `salesOpen: true`.

**What CI would need to do to become real evidence:** either (a) run the
hermetic `build_isolated.sh` procedure itself as a CI step (so the *env
shape* CI tests matches production's), or (b) fix the `NEXT_PUBLIC_SANITY_DATASET`
secret so CI's Sanity reads succeed and salesOpen reflects real data (so the
Admin SDK path is actually exercised) — ideally both. Neither is in scope for
this contract; recorded here so it isn't lost.

## The real repro (captured, not asserted)

`repro-build-defect.log` in this directory is the actual, unedited-except-for-
a-header transcript of running the hermetic procedure
(`build_isolated.sh`'s exact logic) against the real repo on 2026-08-12: `.env.local`
genuinely moved aside, only the real `apphosting.yaml`'s 8 BUILD-availability
vars injected via `env -i`. It fails exactly as production does, and
`.env.local` was restored and verified byte-identical afterward
(`RESTORE-OK`). `selftest.py` replays this file rather than re-running the full
build, so every gate execution doesn't pay a ~90s tax proving something that
was already proven once, honestly, and recorded.

## Why replay, not re-run

Re-deriving "the defect-detecting assertion genuinely fails today" by
re-running the real `pnpm build` inside `selftest.py` would be more direct,
but it means every future gate run — including ones long after this bug is
fixed — pays the full build cost twice (once in the self-test, once in A2) for
no additional information, since after the fix A2 will simply pass and the
self-test's "prove it CAN fail" claim becomes untestable without deliberately
reintroducing the bug (which would itself be destructive and racy against a
real developer's working tree). The middle path taken here: `selftest.py`
verifies the *tooling* (extraction, isolation, restore, sweep, guards) against
fast synthetic fixtures every run, and separately trusts one honestly-captured,
timestamped, reproducible-on-demand real transcript as proof the tooling's
real-world target (an actual `pnpm build`) genuinely exhibits the failure this
contract exists to catch. Anyone doubting the replay can regenerate it by
running `build_isolated.sh` for real against `HEAD` before the fix lands — the
procedure is the same one A2 uses.

## What "fixed" means (outcome, not mechanism)

This contract does NOT mandate `export const dynamic = 'force-dynamic'`,
moving the admin call behind a route handler, or any other specific technique
— that choice belongs to @dev. It asserts the **outcome**:

1. `pnpm build` succeeds with `.env.local` absent and only apphosting.yaml's
   current BUILD vars present (A2).
2. No page under `app/` both prerenders (static or ISR — the Next default
   unless a page opts into request-time rendering) and transitively imports
   `firebase-admin` (A3). A2 alone is not sufficient proof of this in the
   general case — a build could "succeed" by silently swallowing the error and
   shipping a broken page — so A3 exists as an independent, mechanism-agnostic
   check of the actual import graph.
3. The forbidden shortcut (promoting the Admin secrets to BUILD-availability,
   under their real names or a renamed copy) was not taken (A4-A6, negative
   controls against `apphosting.yaml`).
4. The existing 60s CDN-staleness intent (`contracts/cms-loop-f1-cdn-purge.yaml`)
   is undisturbed on every OTHER page that currently carries it (A7) — this fix
   is free to change `/tickets` itself, but must not silently ripple onto
   unrelated routes.

"Sold counts are not baked into the build output" (an explicit design
constraint in the mission brief) is not asserted as a separate check: it
follows by construction from A2. The Admin SDK path throws immediately without
credentials — if the fix makes the build succeed without those credentials
present, then by definition no live-Firestore-sourced sold count was computed
during that build. Asserting it separately would either duplicate A2 or
require inventing a way to inspect prerendered HTML for the *absence* of data
that was never fetched, which is strictly weaker evidence than the build
having had no way to fetch it at all.

## Scope: what was swept and why

`app/admin/**` and `app/api/**` were reasoned about explicitly, not assumed
safe:

- `app/admin/page.tsx` calls `cookies()` (via `next/headers`), which forces
  Next to render it per-request — confirmed in the CI build's route table
  (`ƒ /admin`, not `○`). It transitively imports `firebase-admin` (directly),
  and is correctly exempted by the sweep's dynamic-rendering check, not by
  living under `/admin`.
- `app/(marketing)/events/submit/page.tsx` is the same shape — `cookies()`-
  gated (`ƒ /events/submit` in the route table), transitively reaches
  `firebase-admin` via a dynamic `import()`, correctly exempted for the same
  reason.
- `app/api/**` route handlers are out of scope by construction — Next route
  handlers default to per-request execution and are never included in this
  script's `page.tsx` sweep. That default is not merely assumed: verified none
  of `app/api/tickets/**` or `app/api/admin/**` declare `export const dynamic
  = 'force-static'` (grep, see A8) which would be the one way an API route
  could opt into the same trap.
- `app/(marketing)/tickets/confirmation/page.tsx` is a `'use client'`
  component with no server-side Admin SDK import at all — excluded on both
  counts.
- `app/(marketing)/tickets/cancelled/page.tsx` reads `searchParams`, which
  forces per-request rendering (`ƒ /tickets/cancelled` in the route table,
  despite carrying its own `revalidate = 60`, which is simply inert there) —
  and it never imports `lib/data/tickets.ts` or `firebase-admin` at all.
  Confirmed doubly safe, not assumed.

The sweep script (`check_no_prerendered_admin_routes.py`) makes this reasoning
mechanical rather than tribal: it classifies every `page.tsx` by actual
Next.js dynamic-rendering triggers (`'use client'`, `cookies()`/`headers()`,
`export const dynamic = 'force-dynamic'`), not by directory name, and reports
pages that reach `firebase-admin` in BOTH the safe and violation buckets so a
reviewer can see the classifier reasoned about each one rather than silently
skipping it.

## A real gotcha the sweep script had to solve

The first prototype of `check_no_prerendered_admin_routes.py`, run against the
real repo, flagged 16 unrelated pages (`about`, `contact`, `national-show/*`,
the homepage, `societies/*`...) as violations. The cause: `types/index.ts`
contains `import type { Timestamp } from 'firebase-admin/firestore'` — a
type-only import, erased entirely at compile time, creating no runtime
dependency. Every page that imports the shared `types` module (nearly the
whole site) was a false positive until the import scanner explicitly skipped
lines starting with `import type`. `fixtures/sweep-fixture/app/types-only-user/`
and `fixtures/sweep-fixture/types/index.ts` reproduce this exact shape so
`selftest.py` proves the exclusion is load-bearing, not incidental.

## Gate run record (2026-08-12, pre-fix)

- `selftest.py` (A1): **PASS** — every detector proven against fixtures.
- Real `build_isolated.sh` run against the actual repo (the same procedure A2
  runs): **FAILS** as expected — `Error: Missing Firebase Admin credentials`,
  exit 1, `.env.local` restored byte-identical. Transcript:
  `repro-build-defect.log`.
- `check_no_prerendered_admin_routes.py` against the real repo (A3): **1
  violation** — `app/(marketing)/tickets/page.tsx`, exactly the known defect.
  `app/admin/page.tsx` and `app/(marketing)/events/submit/page.tsx` correctly
  reported as reaching `firebase-admin` but not flagged.
- `check_apphosting_guard.py` all three subcommands against the real
  `apphosting.yaml` (A4-A6): **PASS** — the defect has not (yet) been
  "fixed" via the forbidden shortcut, because no fix has been applied yet.
- `revalidate = 60` sweep (A7): **PASS** — all 17 other CMS-backed pages still
  carry the F1 cms-loop directive.

A2 and A3 are expected to flip to PASS once @dev implements a fix; A4-A7 are
negative controls and must stay PASS throughout.
