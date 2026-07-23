# Sanity Studio `/studio` route crash — Golden Files & Implementation Spec

**P0.** The entire `/studio` route returns a hard **500** under `pnpm dev`. Confirmed via
direct HTTP request to `http://localhost:3002/studio`:

```
Module not found: ESM packages (@sanity/vision) need to be imported.
Use 'import' to reference the package instead.
```

This is a **sibling, not a duplicate**, of the already-resolved
`contracts/contract-sanity-react-peer-fix.yaml` mission. That contract fixed a *runtime*
`React.useEffectEvent` crash inside the Structure Tool's document edit pane (root cause:
`package.json`'s react/react-dom range was too loose — now fixed, `^19.2.2`). **This**
contract fixes a completely different, unrelated *build-time module-resolution* crash that
happens earlier in the request lifecycle — before the Structure Tool ever gets a chance to
render anything. Do not conflate the two fixes or re-verify the react-peer fix here.

Fixing this bug is a **prerequisite** for the still-open P0 investigation tracked in
`.agent/memory/project/needs-human.md` ("RF-11: Sanity Studio edit-pane manual browser
verification") — that verification needs a working local dev Studio, which this crash
currently prevents entirely. This contract does not perform that verification; it only
unblocks it.

---

## Confirmed root cause

`sanity.config.ts` (current, unfixed — read in full at authoring time):

```ts
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

const plugins = [structureTool()];

if (process.env.NODE_ENV === 'development') {
  // Vision (GROQ scratchpad) is dev-only to keep the production Studio bundle small.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { visionTool } = require('@sanity/vision');
  plugins.push(visionTool());
}

export default defineConfig({
  name: 'saoc',
  title: 'South African Orchid Council',
  basePath: '/studio',
  projectId,
  dataset,
  plugins,
  schema: { types: schemaTypes },
});
```

Line 13's `require('@sanity/vision')` is the crash site. `@sanity/vision@5.30.0`'s
installed `package.json` declares:

```json
"type": "module",
"main": "./lib/index.js",
"exports": { ".": "./lib/index.js", "./package.json": "./package.json" },
"sideEffects": ["*.css", "*.css.ts"]
```

(full extract in `vision-esm-facts.golden.json`). `"type": "module"` means every `.js` file
in the package — including the one `"main"` points at — is an ES module. There is no CJS
build and no `"require"` condition in the `exports` map. A CommonJS `require()` has
**nothing valid to resolve to**. This is a genuine format incompatibility, not a bundler
misconfiguration — webpack correctly refuses and surfaces the error verbatim in the bug
report.

`sanity.config.ts` is imported by `app/studio/[[...tool]]/StudioClient.tsx`, a `'use
client'` component (`import config from '../../../sanity.config'`), so this file goes
through **client-side** webpack bundling. `next.config.ts`'s `serverExternalPackages:
['sanity', 'next-sanity', '@sanity/vision']` does not rescue it — that option only affects
server-side bundling, not the client bundle a `'use client'` component pulls in.

---

## Fix pattern decision

The task brief offered two standard patterns for this exact class of bug:

1. Static top-level `import { visionTool } from '@sanity/vision'`, with the plugin
   conditionally *included in the array* (not conditionally *imported*), based on
   `process.env.NODE_ENV`.
2. A dynamic `import('@sanity/vision')`, kept genuinely lazy/out of the production bundle.

**Decision: pattern 1 (static import + conditional array-spread).** Reasoning:

- **`defineConfig`'s `plugins` field needs an array of already-resolved plugin objects**,
  not promises. A dynamic `import()` returns a `Promise`, which would force
  `sanity.config.ts`'s module-level code (or `defineConfig`'s call site) into an async
  shape — e.g. top-level `await`, or restructuring `StudioClient.tsx` to resolve the config
  asynchronously before rendering `<NextStudio>`. That's a materially bigger, riskier change
  to a file that currently exports a synchronous `defineConfig(...)` result, for a plugin
  (a GROQ debug console) where lazy-on-demand loading was never the actual goal — "dev-only"
  was the goal, which pattern 1 achieves without any async restructuring.
- **The existing code already expresses "conditionally build up `plugins` based on
  `NODE_ENV`"** via `if (...) { plugins.push(...) }` — a *dynamically constructed* array,
  not a static literal. Pattern 1's `...(condition ? [visionTool()] : [])` spread is the
  same intent in idiomatic modern form; it's the minimal-diff fix that preserves the
  existing file's shape rather than introducing a new async paradigm alongside it.
- **The "keep production bundle small" comment's underlying goal is not defeated by a
  static import**, because `@sanity/vision`'s `package.json` marks its non-CSS files
  `sideEffects: false` (see `vision-esm-facts.golden.json`). That's exactly the signal
  webpack's tree-shaking needs to safely drop an imported-but-unused-in-this-branch module
  from the final bundle. Combined with webpack's `NODE_ENV`-based dead-branch pruning
  (`ConstPlugin`, confirmed empirically below), the `visionTool()` reference inside
  `... ? [visionTool()] : []` is eliminated from the production bundle exactly as it is
  today — the import is *resolved at build time* (a compile-time cost only) but not
  *shipped in the runtime bundle*.
- **Empirical confirmation this pruning mechanism is real and already active in this repo**,
  captured at authoring time by running `pnpm build` against the *current, unfixed*
  `sanity.config.ts` (still has the broken `require()`):

  ```
  ├ ƒ /studio/[[...tool]]                    1.65 MB        1.75 MB
  ```

  `pnpm build` **succeeds today** even though the require() is present and would crash if
  reached — because in a production build `NODE_ENV` is statically `"production"`, so
  webpack's parser recognizes `if (process.env.NODE_ENV === 'development')` as unreachable
  and never adds `require('@sanity/vision')` to the module graph at all. This is direct
  proof the crash is **dev-only**, and direct proof the `NODE_ENV`-conditional mechanism
  this fix relies on for bundle-size preservation is already working in this exact file
  today (full detail in `vision-esm-facts.golden.json` → `authoring_time_build_baseline`).

Dynamic `import()` remains a documented fallback (see the target-shape golden's comment)
only if a future QA pass finds the static-import approach actually does leak into the
production bundle in practice — but the sideEffects + build evidence above says it won't,
so it is not the chosen implementation here.

---

## What the fix must do

1. Replace `const { visionTool } = require('@sanity/vision')` with a static top-level
   `import { visionTool } from '@sanity/vision'`.
2. Change `const plugins = [structureTool()]; if (NODE_ENV === 'development') { plugins.push(visionTool()) }`
   to build the array in one expression: `const plugins = [structureTool(), ...(process.env.NODE_ENV === 'development' ? [visionTool()] : [])];`
   (or equivalent — see `sanity.config.ts.target-shape.golden` for the full reference file).
3. Remove the now-unneeded `// eslint-disable-next-line @typescript-eslint/no-require-imports`
   comment (there is no require() left to disable the rule for).
4. Do **not** change `next.config.ts` — the `exportsPresence = false` webpack workaround
   there is unrelated (it suppresses a *different*, React-specific static-analysis false
   negative, not anything to do with `@sanity/vision`) and is out of scope for this fix.
5. Do **not** make Vision always-included (that reintroduces the production-bundle-bloat
   problem the original dev-only guard existed to prevent) and do **not** drop it from dev
   (that's a behavior regression, not a fix).

---

## What "fixed" must mean (maps to contract assertion IDs)

- **VF-01**: no `require('@sanity/vision')` remains anywhere in `sanity.config.ts` — the
  literal crash site is gone.
- **VF-02**: a genuine ESM import of `visionTool` from `'@sanity/vision'` exists (static or
  dynamic — VF-02 doesn't hard-gate on which, though the recommended/expected
  implementation is the static form per the reasoning above).
- **VF-03**: `structureTool()` is still unconditional, and `visionTool()`'s inclusion is
  still textually gated by a `NODE_ENV === 'development'` check nearby — no behavior change
  to dev-vs-prod plugin availability.
- **VF-04**: the actual bug — with `pnpm dev` running, `/studio` no longer returns a 500,
  and the response body contains neither "Module not found" nor "ESM packages" (the exact
  strings from the confirmed bug report).
- **VF-05**: `pnpm build` still succeeds and the build output still lists the
  `/studio/[[...tool]]` route — don't regress the thing that already works. (Baseline
  captured above: it already passes today, even pre-fix, so this assertion is a pure
  regression guard.)
- **VF-06**: `pnpm type-check` still passes.
- **VF-07** (staleness guard): `@sanity/vision`'s installed `package.json` still declares
  `"type": "module"`. If this ever fails, the package added CJS support (or was replaced)
  since this contract was written, and the whole premise needs re-checking, not just a
  patch to satisfy stale facts.

No `agent_review` / human-queue assertion is needed here (unlike RF-11 in the sibling
contract) — every check in this contract is fully shell/grep/HTTP-verifiable. The one thing
this contract deliberately does **not** claim to verify is whether the Studio UI is fully
functional once loaded in an authenticated browser session (document list rendering,
editing, etc.) — that's the separate, still-open P0 tracked in
`.agent/memory/project/needs-human.md`, which this fix unblocks but does not itself resolve.
