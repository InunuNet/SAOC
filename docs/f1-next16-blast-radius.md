# F1 — Next.js 15.5.19 → 16.x Blast-Radius Assessment

**Status:** Investigation only. Zero dependency changes made. Feeds the M1 go/no-go gate
for `studio-next16-upgrade`.

**Sources:** Official upgrade guide, fetched via Alembic
(`http://localhost:7077/https://nextjs.org/docs/app/guides/upgrading/version-16`,
`nextjs.org/docs/app/guides/upgrading/version-16.md`, retrieved 2026-07-29). All
"breaking change" claims below are quoted/paraphrased from that page unless marked
"inferred". Next-16-vendored-React version table is carried over from the mission file's
confirmed root-cause evidence (`npm pack` + grep, 2026-07-29) — not re-derived here.

Current versions confirmed by reading this repo: `next@15.5.19` (`package.json`,
`node_modules/next/package.json`), `react@19.2.7` / `react-dom@19.2.7` (resolved, per
`pnpm-lock.yaml`), `eslint-config-next@15.5.19`, `sanity@5.31.1`, `next-sanity@11.6.13`,
TypeScript `^5.7.0` (declared) / `5.9.3` (resolved), Node `v26.4.0` (local, `node -v`).

---

## Risk register

| # | Severity | Area | File(s) | What breaks | Remediation |
|---|----------|------|---------|--------------|-------------|
| 1 | **HIGH** | Caching API — `revalidateTag` signature | `app/api/revalidate/route.ts:22,24` | `revalidateTag('sanity')` and `revalidateTag(body._type)` are single-argument calls. Per the official guide: *"`revalidateTag` now requires a second argument specifying a `cacheLife` profile. The single-argument form is deprecated and will produce a TypeScript error."* This is the Sanity webhook → on-demand ISR revalidation path — it will fail `pnpm type-check` and block the build under Next 16 as-is. | Add a second argument, e.g. `revalidateTag('sanity', 'max')` and `revalidateTag(body._type, 'max')`. This is a webhook-triggered background revalidation (stale-while-revalidate is acceptable), so `revalidateTag(..., 'max')` is the correct profile, not `updateTag` (which is Server-Actions-only and gives read-your-writes semantics — not applicable to a route handler). |
| 2 | **HIGH** | Turbopack-by-default vs. custom `webpack()` config | `next.config.ts` (the `webpack()` block, exportsPresence hack) | Next 16 makes Turbopack the default for **both** `next dev` and `next build`. Per the guide: *"If your project has a custom webpack configuration and you run `next build` (which now uses Turbopack by default), the build will **fail** to prevent misconfiguration issues."* `next.config.ts` currently defines a `webpack()` function, and `package.json`'s `build` script is plain `next build` (no `--webpack`/`--turbopack` flag) — so `pnpm build` will hard-fail immediately post-upgrade unless this is addressed. | Per the mission file's confirmed root cause, this block was written against a **disproven theory** (it assumed Turbopack/webpack's static export analysis was the cause of the `useEffectEvent` crash; the actual cause is that Next 15's *vendored* React lacks the export, which the Next 16 upgrade itself fixes by vendoring React 19.3). The block should be **deleted outright** as part of F3, not migrated to a Turbopack equivalent — it addresses a bug that no longer exists after the upgrade, and removing it lets both `dev` and `build` use Turbopack cleanly with zero extra flags. |
| 3 | MED | Node runtime floor (App Hosting, not local) | `apphosting.yaml` (no explicit Node pin) | Next 16 requires Node **20.9+** (LTS; Node 18 dropped) and TypeScript **5.1+**. Local dev machine is Node v26.4.0 — no local conflict. `apphosting.yaml` does not pin a Node version, so the SSR runtime's Node version is whatever Firebase App Hosting auto-detects/defaults to. | Not this feature's call to resolve — **flagging for F2**: confirm App Hosting's Next-16-era SSR runtime Node version meets the 20.9+ floor. If App Hosting still runs an older Node LTS by default, that's a hard blocker independent of Next-code changes. |
| 4 | LOW-MED | Package lockstep | `package.json` (`eslint-config-next: 15.5.19`) | Guide implies `eslint-config-next` and `@next/*` packages move in lockstep with `next`. Repo already uses **flat ESLint config** (`eslint.config.mjs`) and runs lint via `eslint .` directly (not the removed `next lint` command), so the ESLint-Flat-Config and `next lint` removal items in the guide are **not applicable** — only a version bump is needed. | Bump `eslint-config-next` to the matching 16.x version alongside `next`/`react`/`react-dom` in F3. No config-format migration required. |
| 5 | LOW (informational) | `og/route.tsx` edge runtime | `app/og/route.tsx:4` (`export const runtime = 'edge'`) | Not a Next-16 breaking change — the guide's `edge`-runtime note is scoped to `middleware`→`proxy` (this repo has no `middleware.ts`, confirmed below), not to route handlers. Route-handler `runtime = 'edge'` is unaffected. | No code change needed. Cross-reference for **F2**: confirm Firebase App Hosting still serves this edge-runtime route handler correctly (pre-existing behavior, not introduced by the upgrade). |

## Verified not applicable (checked against this codebase, not assumed)

- **Async Request APIs removal of sync access** (`cookies`, `headers`, `draftMode`,
  `params`, `searchParams`) — grepped every `page.tsx`/`layout.tsx`/`route.ts` under `app/`.
  Every dynamic-param page (`(marketing)/societies/[slug]/page.tsx`,
  `(marketing)/events/[slug]/page.tsx`, `(marketing)/national-show/archive/[year]/page.tsx`,
  `api/events/[slug]/ics/route.ts`) already types `params` as `Promise<{...}>` and `await`s
  it. Every `cookies()`/`draftMode()` call site (`app/admin/page.tsx`,
  `app/(marketing)/events/submit/page.tsx`, `app/api/draft/route.ts`,
  `app/api/disable-draft/route.ts`, `app/api/admin/{tickets,export-csv,checkin,session}/route.ts`)
  already uses `await cookies()` / `await draftMode()`. No `searchParams` prop usage found
  in any `page.tsx`. **Zero remediation needed** — this repo did its Next-15 async migration
  correctly and Next 16's removal of the sync compatibility shim has nothing to bite.
- **`middleware` → `proxy` rename** — no `middleware.ts`/`middleware.js` exists at the repo
  root (`find . -maxdepth 1 -name middleware.ts` empty). Not applicable.
- **Parallel routes `default.js` requirement** — no `@slot`-style parallel-route folders
  exist anywhere under `app/` (checked via `find app -name "@*"`, empty). Not applicable.
- **`next/legacy/image`, `images.domains`** — neither string appears anywhere in `app/` or
  `components/`; `next.config.ts` only uses `images.remotePatterns`. Not applicable.
- **Local image query-string `localPatterns` requirement** — every local `<Image src="/...">`
  call (checked in `app/not-found.tsx`, `national-show/*`, `components/home/*`,
  `components/chrome/*`) uses a plain path with no `?query`. Not applicable.
- **`images.qualities` default narrowing to `[75]`** — no component passes an explicit
  `quality` prop (grepped `components/`, `app/`, zero hits). Default was and remains
  effectively 75 for this codebase; no visual regression expected.
- **`images.minimumCacheTTL` default bump (60s → 4h)** — all current images are
  `remotePatterns` (`firebasestorage.googleapis.com`, `cdn.sanity.io`) or static local
  assets, not user-uploaded/frequently-changing sources. No functional break; at most a
  slightly longer cache window for CMS-swapped images, acceptable for this site's update
  cadence.
- **AMP removal, `serverRuntimeConfig`/`publicRuntimeConfig` removal,
  `unstable_cacheLife`/`unstable_cacheTag` prefix removal, `unstable_rootParams` removal,
  `experimental_ppr`/PPR flag removal, `experimental.dynamicIO`/`experimental.useCache`
  deprecation** — none of these strings appear anywhere in `next.config.ts`, `app/`, or
  `lib/` (grepped each). Not applicable.
- **`next lint` command removal** — `package.json`'s `lint` script is already `eslint .`,
  not `next lint`. Not applicable, no codemod needed.
- **`serverExternalPackages`** (explicitly called out in the mission brief) — already
  removed from `next.config.ts` in the prior Studio-SSR-fix work (per
  `docs/sanity-studio-p0-investigation.md:40-44`); current `next.config.ts` has no such
  key. Next 16 makes no further change here since the key is already absent — not
  applicable, nothing to re-add or re-remove.
- **`next-sanity` / `sanity` Next-16 peer compatibility** — read
  `node_modules/next-sanity/package.json`: peer range is
  `"next": "^15.1.0-0 || ^16.0.0-0"` — **already declares Next 16 support** at the
  currently-installed `next-sanity@11.6.13`. `sanity@5.31.1`'s `peerDependencies` only
  list `react`, `react-dom`, `styled-components` — no `next` peer at all. **No CMS-side
  dependency conflict for the Next-16 bump itself** (independent of the React-vendoring
  root cause this upgrade is fixing).
- **Route groups `(marketing)`, `admin`, `studio`** — purely a filesystem/URL-segment
  organization feature; the upgrade guide documents no behavioral change to route
  grouping. Not applicable.
- **`app/studio/[[...tool]]/page.tsx`** catch-all route + `export const dynamic =
  'force-dynamic'` — standard App Router convention, no Next-16 change affects it.
- **Scroll-behavior override change** — `app/globals.css` and `app/layout.tsx` set no
  `scroll-behavior: smooth` anywhere (grepped both), so the new default (no override
  during navigation) is a no-op here.
- **Enhanced routing/prefetching, concurrent `dev`/`build` output split
  (`.next/dev`), removed build-output size metrics** — informational/performance-only
  changes, require no code changes.

## Codemods

Recommended for F3: run `pnpm dlx @next/codemod@canary upgrade latest` as the primary
upgrade mechanism (it also bumps `react`/`react-dom` and updates `next.config` turbopack
shape). Given the "not applicable" findings above, the other individually-named codemods
(`next-lint-to-eslint-cli`, `migrate-to-async-dynamic-apis`, middleware→proxy rename) have
nothing to migrate in this repo — the `upgrade` codemod running them is a no-op safety net,
not a required step to unblock anything.

## Version recommendation

**Pin `next@16.2.12` exact** (matches `package.json`'s existing pattern of exact-pinning
`eslint-config-next`, and is the latest stable per the mission file's confirmed
`npm pack` probe table, 2026-07-29: vendors React `19.3.0-canary-3f0b9e61-20260317`, which
exports `useEffectEvent` — this is what actually closes the P0). No reason surfaced in this
investigation to prefer an earlier 16.x release; nothing found here depends on a 16.0-era
API that later 16.x releases changed.

## Bottom line

**F1 verdict: tractable, with two concrete pre-flight fixes required before/during F3,
not after.**

1. `app/api/revalidate/route.ts` will fail type-check on `revalidateTag` under Next 16 —
   two-line fix (add `'max'` second argument), but it must happen as part of F3, not be
   discovered by F4.
2. The `next.config.ts` `webpack()` block will make `pnpm build` hard-fail under
   Turbopack-by-default — it must be deleted (not migrated) as part of F3, since it
   addresses a root cause the upgrade itself makes moot.

Neither is a project-killer; both are known, small, and already have a stated fix. The
**biggest single risk to the whole mission is not in this file — it's F2's Firebase App
Hosting Node/Next-16-SSR-support question** (row 3 above). Everything in this
codebase's own source is Next-16-ready or trivially fixable; whether the hosting platform
can run Next 16 at all is the actual gate. Async APIs, image config, routing, middleware,
and CMS peer-dependency surfaces are all clean — this is a narrow, well-understood blast
radius, not a broad one.

**Recommendation: proceed to F2.** Do not proceed to F3 until F2 returns a go on App
Hosting Next-16 SSR support.
