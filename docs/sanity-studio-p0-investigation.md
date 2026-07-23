# Sanity Studio P0 Investigation — Document Edit Pane Not Rendering

**Status:** Two real, gate-verified fixes shipped. The originally-reported bug is **not
confirmed fixed**. One open item (RF-11) needs a human to reproduce with real credentials.

**Contracts:**
[`contracts/contract-sanity-react-peer-fix.yaml`](../contracts/contract-sanity-react-peer-fix.yaml) ·
[`contracts/contract-sanity-vision-esm-fix.yaml`](../contracts/contract-sanity-vision-esm-fix.yaml)

**Golden specs:**
[`contracts/golden/sanity-react-peer-fix/README.md`](../contracts/golden/sanity-react-peer-fix/README.md) ·
[`contracts/golden/sanity-vision-esm-fix/README.md`](../contracts/golden/sanity-vision-esm-fix/README.md)

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

## What remains open

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
