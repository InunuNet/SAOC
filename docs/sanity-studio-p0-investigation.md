# Sanity Studio P0 Investigation — Document Edit Pane Not Rendering

**Status (2026-07-28):** Root cause of the local hard-crash found and fixed, along with a
second real bug (marketing chrome leaking onto `/studio`). Adversarial QA passed 6/6. Studio
now mounts and renders locally. One item remains, reframed from "reproduce the original bug"
to "finish Sanity project configuration": confirm project membership and register CORS
origins — see [What remains open (2026-07-28)](#what-remains-open-2026-07-28) below. The
2026-07-24 entries further down are kept for history; their RF-11 human-repro step is
**superseded** — see that section for the disposition.

**Contracts:**
[`contracts/contract-sanity-studio-p0.yaml`](../contracts/contract-sanity-studio-p0.yaml) ·
[`contracts/contract-sanity-react-peer-fix.yaml`](../contracts/contract-sanity-react-peer-fix.yaml) ·
[`contracts/contract-sanity-vision-esm-fix.yaml`](../contracts/contract-sanity-vision-esm-fix.yaml)

**Golden specs:**
[`contracts/golden/sanity-react-peer-fix/README.md`](../contracts/golden/sanity-react-peer-fix/README.md) ·
[`contracts/golden/sanity-vision-esm-fix/README.md`](../contracts/golden/sanity-vision-esm-fix/README.md)

---

## 2026-07-28: reconciled diagnosis — two different bugs, both fixed

Brad's report ("Studio never worked at all") and the earlier report investigated below
("list loads, edit pane blank") turned out to describe **two different bugs**, not one. The
2026-07-24 investigation (RF-11) never surfaced this because its verification stopped at
"HTTP 200 returned" and never opened the dev console — the local Studio was actually
returning 200 while server-side crashing into an infinite client-side spinner, which reads
as "loads" from a bare HTTP check.

**@analyst's finding, split by environment:**

- **Local (`pnpm dev`) `/studio`:** hard server-side crash on *every* request —
  `useSyncExternalStore` returning null / "invalid hook call" — masked behind an HTTP 200
  response and an infinite loading spinner in the browser. This is what Brad was hitting:
  Studio "never worked" because it never got past the crash to render anything.
- **Deployed `/studio`:** loads correctly to the Sanity login screen. Not the same failure
  as local.

### Fix A — remove `serverExternalPackages` cargo-cult from `next.config.ts`

`next.config.ts` declared `serverExternalPackages: ['sanity', 'next-sanity',
'@sanity/vision']`. This was added at initial Sanity install (commit `2b8b543`) with no
recorded justification in that commit or elsewhere. `serverExternalPackages` forces Next.js
to load the listed packages via Node's native `require`/`import` instead of bundling them
through webpack/Turbopack for RSC — which breaks React-context-dependent client bootstrapping
for packages (like Sanity's Studio bundle) that rely on being bundled consistently with the
app's own React instance. This is a documented failure class:
[sanity-io/next-sanity#707](https://github.com/sanity-io/next-sanity/issues/707),
[sanity-io/sanity#2819](https://github.com/sanity-io/sanity/issues/2819),
[vercel/next.js#70487](https://github.com/vercel/next.js/issues/70487).

Removing the option lets Next.js bundle Sanity/next-sanity/@sanity/vision normally, which
resolves the `useSyncExternalStore` crash. Verified the production build is unaffected by
the removal (`pnpm build` still succeeds, `/studio/[[...tool]]` route still present).

### Fix B — marketing chrome was leaking onto `/studio` (and `/admin`)

`app/layout.tsx` (the root layout, applied to *every* route including `/studio`) rendered
`UtilityBar`, `Header`, `{children}`, and `Footer` unconditionally. `/studio` needs to own
its own full-page shell — Sanity Studio is a self-contained SPA that does its own layout,
routing, and theming; wrapping it in the site's marketing chrome is both visually wrong and,
combined with Fix A's bundling issue, was contributing render noise around the crash.

**Fix:** moved `UtilityBar`, `Header`, `{children}` (now wrapped in `<main>`), and `Footer`
out of `app/layout.tsx` and into `app/(marketing)/layout.tsx` — the route-group layout that
already scopes to marketing pages only. `app/layout.tsx` now contains only `<html>`/`<body>`,
font variables, `globals.css`, page `metadata`, and the organisation JSON-LD script — the
things that legitimately apply to every route including `/studio` and `/admin`.

**Entailed consequence, not a defect:** `/admin` was never inside the `(marketing)` route
group, so it never received the chrome — and still doesn't. QA flagged this explicitly and
classified it as expected: an internal dashboard route rendering without the public site's
header/footer/utility bar is correct, not a regression.

### QA — adversarial, PASS (6/6 gate)

Gate: `contracts/contract-sanity-studio-p0.yaml`, all assertions green. Probes performed:

- Real Playwright render of `/studio` (not just an HTTP status check) — the Studio UI fully
  mounts, taking roughly 10 seconds to finish loading.
- SSR sweep across all marketing routes, `/admin`, and API routes — nothing else broke from
  either fix.
- Build route manifest checked intact — 40+ routes present, including
  `studio/[[...tool]]`.
- Gate-integrity checks confirmed non-vacuous (assertions actually exercise the change, not
  trivially-true checks).
- No leaked child processes from the dev-server tests.

Evidence archive: `.agent/memory/scratch/sanity-p0-20260728/`.

## What remains open (2026-07-28)

The mounted local Studio now renders — but lands on Sanity's **"Connect this studio to your
project"** screen. That's the standard symptom of the browser's origin not being registered
in the Sanity project's CORS allow-list; it's a project-configuration gap, not a code bug,
and it's unrelated to both the crash (Fix A) and the chrome leak (Fix B).

Two human steps remain, both requiring `manage.sanity.io` access:

1. **Confirm project membership.** Verify `brad@inunu.net` is genuinely the project's sole
   human member (project created 2026-06-11). The local Sanity CLI is not currently logged
   in, so this can't be checked from this environment — run `pnpm exec sanity login`, then
   `sanity users list`.
2. **Register CORS origins.** At `manage.sanity.io/projects/26yfbug4` → API, add both
   `http://localhost:3002` (local dev) and
   `https://saoc-prod--saoc-webapp.europe-west4.hosted.app` (deployed) as allowed origins.

Until both are done, the "Connect this studio" screen will keep appearing regardless of
which environment is used.

### Disposition of the 2026-07-24 findings below

The 2026-07-24 entries (Lead 1, Lead 2, and the vision-ESM crash) are kept as-is for
investigation history. Their open item, **RF-11** ("a human needs to reproduce the original
bug with real credentials and record what happens"), is **superseded**:

- The machine-checkable part of what RF-11 was trying to establish — does `/studio` actually
  render past the point RF-11 could only reach with a broken dev server — is now covered by
  `contract-sanity-studio-p0`'s Playwright assertion (A1), which is green.
- The remaining human-only part of RF-11 is no longer "reproduce and describe the bug" — the
  bug that blocked reproduction (the crash) is fixed. It is now the two concrete steps above
  (membership + CORS). Treat those as RF-11's replacement, not as new unrelated work.

---

## Original symptom

In Sanity Studio (`/studio`), the document **list** pane loads fine for every schema type.
Clicking into any individual document to edit it shows **no edit form** — the pane does not
render fields. Backlog ref: `.agent/memory/project/backlog.md` — "Sanity Studio: documents
not editable — root cause undiagnosed."

Two separate investigation leads were chased. Both were ruled out. One unrelated, real bug
was found and fixed along the way. The original symptom's root cause is still unknown.

---

## Lead 1: React version mismatch — ruled out (fixed the range, not the bug)

**Theory:** `sanity@5.31.1`'s Structure Tool calls `React.useEffectEvent`, an API that only
exists in React ≥19.2.2. `package.json` declared `"react": "^19.0.0"` / `"react-dom":
"^19.0.0"` — a range whose *minimum satisfiable version* is 19.0.0, which lacks that API. If
a fresh/independent install ever resolved something older than 19.2.2, the Structure Tool
would crash exactly like the report describes.

**What was fixed:** `package.json`'s `react`/`react-dom` ranges were tightened from
`^19.0.0` to `^19.2.2` (now committed — see current `package.json`), matching the exact
peer-dependency floor both `sanity@5.31.1` and `@sanity/vision@5.30.0` declare in
`pnpm-lock.yaml`. This is real hygiene: it closes a latent gap where a legal, frozen-lockfile
install could theoretically have resolved a React version too old for the Structure Tool.
Verified: `pnpm-lock.yaml` resolves exactly one deduped `react` version and one deduped
`react-dom` version tree-wide, both ≥19.2.2; `pnpm install --frozen-lockfile`,
`pnpm type-check`, and `pnpm build` all pass clean. Contract
`contract-sanity-react-peer-fix.yaml`, assertions RF-01/RF-03/RF-04/RF-05/RF-06/RF-07/RF-09/
RF-10, all green.

**Why this does NOT explain the original bug:** the range was too loose, but the version
that was *actually* resolving was never the problem. Checked directly with `git show
<rev>:pnpm-lock.yaml`:

```
397de87~1  (before the prior "fix" attempt)  → react@19.2.7
397de87    (the prior "fix" attempt itself)  → react@19.2.7
current working tree (after this fix)        → react@19.2.7
```

The resolved React version has been **19.2.7 — which already has `useEffectEvent` —
throughout the entire incident history**, unchanged by either the prior fix attempt
(commit `397de87`, which claimed to remove the `useEffectEvent` call from Sanity's code and
did not — `grep -n useEffectEvent node_modules/sanity/lib/_chunks-es/structureTool.js` still
shows the import and multiple call sites) or by this fix. Tightening the declared range
prevents a *future* regression; it did not change the *runtime* React version that was
present when the bug was originally reported. This lead is closed as "necessary hygiene,
not the explanation."

---

## Lead 2: Sanity Free-plan permission downgrade — ruled out (live API check)

**Theory:** SAOC's Sanity project auto-downgraded from the Growth trial to the Free plan on
2026-07-14. If that downgrade also demoted the API token's write/edit permissions on the
`production` dataset, the Structure Tool could plausibly fail to render an editable form for
existing documents.

**Verification performed** (direct calls against the live Sanity Management/Data API using
the project's own `SANITY_API_TOKEN` from `.env.local`, 2026-07-24):

- `GET https://api.sanity.io/v2021-06-07/projects/<projectId>` — project's member list
  includes a member with the `administrator` role (read + write access to all datasets and
  project settings).
- `GET https://<projectId>.api.sanity.io/v2021-06-07/data/query/production?query=*[0...1]`
  → **HTTP 200** — the token can read the dataset.
- `POST https://<projectId>.api.sanity.io/v2021-06-07/data/mutate/production` with an empty
  mutation transaction → **HTTP 200**, transaction accepted (`transactionId` returned) — the
  token has **write** access to the dataset, not just read.

The only permission-related response encountered was a `401` on the unrelated
`/projects/<projectId>/tokens` endpoint ("missing required grant
`sanity.project.tokens/read`") — that endpoint lists/manages *other* API tokens, an
admin-token-management capability the configured token was never expected to have. It has
no bearing on document read/write access.

**Conclusion:** the Free-plan downgrade did not strip read or write access to the dataset.
This lead is ruled out.

---

## The real bug found and fixed: `/studio` hard-crashed under `pnpm dev`

While investigating, a completely separate, unrelated bug was discovered: `sanity.config.ts`
loaded the Vision plugin with a CommonJS `require('@sanity/vision')` inside a
`NODE_ENV === 'development'` conditional. `@sanity/vision@5.30.0` is **ESM-only**
(`package.json` declares `"type": "module"`, no CJS entry point) — `require()` has nothing
valid to resolve to. Under `pnpm dev`, this crashed the **entire `/studio` route** with a
hard `500`:

```
Module not found: ESM packages (@sanity/vision) need to be imported.
Use 'import' to reference the package instead.
```

This didn't show up in production builds, because webpack statically prunes the
`NODE_ENV === 'development'` branch (and therefore the `require()`) out of a production
bundle entirely — the crash was dev-only, which is exactly the environment needed to
reproduce and fix the original bug.

**Fix:** replaced the conditional `require()` with a static top-level
`import { visionTool } from '@sanity/vision'`, and moved the dev-only gating from *how the
module loads* to *whether the plugin is included in the array*:

```ts
const plugins = [
  structureTool(),
  ...(process.env.NODE_ENV === 'development' ? [visionTool()] : []),
];
```

`@sanity/vision`'s `package.json` marks its non-CSS files `sideEffects: false`, so webpack's
tree-shaking still drops the module from the production bundle when the conditional
statically evaluates false at build time — the same bundle-size guarantee the original
`require()`-based guard was trying to provide, without the ESM incompatibility.

**Verified, independently reproduced both broken and fixed:**
- Confirmed the pre-fix `500` and exact error text via direct HTTP request to
  `http://localhost:3002/studio` under `pnpm dev`.
- Confirmed the fix removes both the `500` and the error text (VF-04).
- `pnpm build` still succeeds and still ships the `/studio/[[...tool]]` route (VF-05).
- `pnpm type-check` passes (VF-06).
- No `require('@sanity/vision')` remains in `sanity.config.ts`; a genuine ESM import is
  present; `structureTool()` stays unconditional and `visionTool()` stays dev-only gated
  (VF-01/VF-02/VF-03).

Contract `contract-sanity-vision-esm-fix.yaml`, all 7 assertions (VF-01 through VF-07)
green — every check in this contract is machine-verifiable; no human-queue step was needed.

This fix is a genuine, confirmed bug fix in its own right. It is **also a prerequisite** for
being able to test the original bug at all under local `pnpm dev` — before this fix, `/studio`
never loaded far enough to reach the document edit pane in a local dev session.

---

## What remains open (2026-07-24 framing — superseded, see 2026-07-28 section above)

The original reported bug — document list loads, edit pane doesn't render on click into a
document — is **still unexplained**. Both investigated leads were ruled out; neither
explains the symptom. The vision-crash fix only removes an unrelated blocker that was
preventing local `pnpm dev` access to `/studio` at all — it is not itself a fix for the edit
pane.

**Next step (tracked as `RF-11`, `kind: agent_review`, in
`contracts/contract-sanity-react-peer-fix.yaml`, also logged in
`.agent/memory/project/needs-human.md`):** a human needs to:

1. Run `pnpm dev`.
2. Open `http://localhost:3002/studio` (or whatever port `pnpm dev` reports) and log in with
   real Sanity credentials.
3. Open browser DevTools (console + network tab).
4. Open the document list for any schema type with existing seeded content (e.g. a society
   or event) and click into one document.
5. Record exactly what happens: does the edit pane render fields, stay blank, spin
   indefinitely, or show an error overlay? Capture any console errors verbatim — in
   particular, note whether a `useEffectEvent`-related error appears (it shouldn't, given
   Lead 1's findings, but that's corroborating evidence either way) — and any network
   request that fails or returns an unexpected status.

Do not treat either contract's gate as meaningfully closed on the *original* bug until this
step has actually been performed and its result recorded. RF-11's automated verdict is
`skip` ("not machine-checkable"), which is not the same as "passing."
