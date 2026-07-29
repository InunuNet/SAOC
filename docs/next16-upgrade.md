# Next.js 15 → 16 Upgrade

Mission `studio-next16-upgrade`, milestone M2 (`F3` execute, `F4` regression pass). Gate:
`contracts/m2-next16-upgrade.yaml`, 19/19 assertions pass. Read alongside
`docs/f1-next16-blast-radius.md` (source-level risk register) and
`docs/f2-apphosting-next16-compat.md` (Firebase App Hosting go/no-go) — this document covers
what was actually done, why, and what upgrading uncovered that neither of those predicted.

**This upgrade is the fix for the Sanity Studio P0.** `docs/sanity-studio-p0-investigation.md`'s
React-peer-range fix (Lead 1, `^19.0.0` → `^19.2.2`) and its Free-plan permission check (Lead 2)
are both **superseded** as explanations for the crash — see [Root cause](#root-cause—the-headline)
below. Neither was wrong as hygiene; neither was the bug.

---

## What changed

| Area | Before | After |
|---|---|---|
| `next` | `^15.3.3` | `16.2.12` (pinned exact) |
| `react` / `react-dom` | `^19.2.2` | `19.2.8` (pinned exact) |
| `eslint-config-next` | `15.5.19` | `16.2.12` |
| `@types/react` / `@types/react-dom` | `^19.0.0` | `19.2.17` / `19.2.3` (pinned, via `pnpm.overrides`) |
| `package.json` `engines.node` | (none) | `>=22` |
| `apphosting.yaml` `runConfig.runtime` | (none — versionless default) | `nodejs22` |
| `next.config.ts` | had a `webpack()` block | block deleted |
| `app/api/revalidate/route.ts` | `revalidateTag(tag)` | `revalidateTag(tag, 'max')` |
| `tsconfig.json` `jsx` | `"preserve"` | `"react-jsx"` |
| `eslint.config.mjs` | `FlatCompat` wrapping `eslint-config-next` | native flat-config import |

`tsconfig.json`'s `jsx: react-jsx` looks like codemod formatting noise but is not — **Next 16
auto-patches this itself and re-applies it on every build.** Confirmed from Next's own build
log: `jsx was set to react-jsx (next.js uses the React automatic runtime)`. Do not revert it;
Next will silently rewrite it back.

---

## Root cause — the headline

Next.js App Router client components resolve `react` to **Next's vendored copy**
(`node_modules/next/dist/compiled/react`), never `node_modules/react`. Next 15.x vendors React
`19.2.0-canary-0bdb9206-20250818`, which does not export `useEffectEvent`. Next 16 vendors
`19.3.0-canary-3f0b9e61-20260317` (16.2.12), which does. Sanity 5.31.1's Structure Tool calls
`useEffectEvent` — hence the crash on opening any document in Studio.

Three prior sessions inspected `node_modules/react` instead — genuinely resolved to 19.2.7,
genuinely exports the API, entirely irrelevant, because that copy is never the one shipped to
the browser bundle.

**Rule:** when diagnosing a client-side React API gap in Next App Router, inspect
`node_modules/next/dist/compiled/react`, not `node_modules/react`. This is now a machine
check, not a claim — `contracts/checks/m2-next16-upgrade/verify-vendored-react.mjs` `require()`s
the vendored copy at `node_modules/next/dist/compiled/react/cjs/react.development.js` and asserts
`typeof mod.useEffectEvent === 'function'` at runtime (contract `A4`).

---

## Upgrade side effects — where the time actually went

The framework-level changes (table above) were small and predicted by F1/F2. The second-order
effects of the dependency bump were not:

- **`eslint-config-next` 16.x ships native flat-config exports.** Consuming them via the old
  `FlatCompat` shim now crashes with `TypeError: Converting circular structure to JSON`.
  `eslint.config.mjs` was rewritten to `import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'`
  and `import nextTypescript from 'eslint-config-next/typescript'` directly, dropping
  `@eslint/eslintrc`/`FlatCompat` entirely.
- **The `@next/codemod` upgrade run bumped ESLint to 10.8.0**, which broke
  `eslint-plugin-react@7.37.5` (it calls the removed `context.getFilename()`; no fixed release
  exists yet). Reverted to `eslint ^9.39.4` — still satisfies `eslint-config-next`'s declared
  `>=9.0.0` peer range, so no functionality was lost by staying on 9.x.
- **A stale `.golden/phase-a-bedrock/` fixture** carried an old `FlatCompat`-based config that
  crashed ESLint 10's nested-config discovery even after the revert to ESLint 9 (ESLint 9 still
  attempts nested-config discovery in that mode). `.golden/**` was added to `eslint.config.mjs`'s
  `ignores` array.
- **`eslint-plugin-react-hooks` 7.1.1 made `react-hooks/set-state-in-effect` an ERROR**, not a
  warning. This forced real rewrites, not just version bumps, in `components/chrome/Header.tsx`,
  `components/chrome/SearchOverlay.tsx`, and `components/show/ShowCountdown.tsx` — each had a
  `useEffect` whose only job was calling `setState`, which the new rule correctly flags as
  work that belongs during render or in an external-store subscription instead.

`Header.tsx` and `SearchOverlay.tsx` moved their `setState`-on-prop-change logic to the
render-phase "adjust state during render" pattern (comparing a `prev*` state value against the
live prop and calling `setState` inline, per
[react.dev/learn/you-might-not-need-an-effect](https://react.dev/learn/you-might-not-need-an-effect)).
`SearchOverlay.tsx` kept its DOM-focus effect as a real `useEffect` — that's a genuine external-
system side effect, not a `setState` relay, so the new rule doesn't (and shouldn't) touch it.

---

## The ShowCountdown hydration bug — the most instructive part

`components/show/ShowCountdown.tsx` (used on `/national-show`) was one of the three
`react-hooks/set-state-in-effect` rewrites. The first rewrite used
`useState(compute)` — a `Date.now()`-derived lazy initializer — in place of the old
effect-based `setInterval`. That introduced a **new** bug: as a Client Component rendered from a
Server Component with no client-only boundary, `compute()` ran once on the server (embedding a
real, non-zero countdown into the SSR HTML) and again independently at hydration, producing two
different numbers.

Reproduced with Playwright under a 3-second `_next/**` throttle (a normal same-machine dev
request hydrates too fast to see the mismatch, which is why local inspection missed it): SSR
rendered `02`, the client rendered `57`, React logged a genuine hydration `pageerror`, and the
whole subtree was discarded and re-rendered — a visible flash on `/national-show`. It did not
reproduce on sub-second localhost loads.

**Fix:** `useSyncExternalStore` with a frozen `getServerSnapshot` (`{ days: 0, hours: 0,
minutes: 0, seconds: 0 }`), so the server and the client's first paint render the exact same
markup, and a per-instance store (`createCountdownStore()`) owns the `setInterval` and hands out
a stable snapshot reference between ticks. Deliberately **not** `suppressHydrationWarning` —
that would silence the visible symptom while leaving the actual mismatch (and the two
independent `Date.now()` reads) in place.

Verified: zero hydration errors under the same 3s-throttle Playwright repro; real ticking
observed across five consecutive seconds (54→53→52→51→50); a 54ms placeholder-to-real-value
flash (the frozen-zero snapshot briefly visible before `useSyncExternalStore` picks up the live
store); interval cleanup confirmed behaviourally (not by reading the code) via a real SPA
navigation away from and back to `/national-show`.

**This is not the same bug as the open home-page hydration issue.** `lib/hooks/useCountdown.ts`
(used by `components/home/ShowBand.tsx` on the home page) has the identical structural bug —
`useState(() => compute(targetDate))` with no client-only boundary — but was **not** touched by
this upgrade: it predates the `react-hooks/set-state-in-effect` rule (last touched 2026-06-01/
06-12) and was out of scope for M2. It reproduces the same way (Playwright, 3s throttle, two
`pageerror`s, mismatched numerals) and has the same known fix — apply the
`useSyncExternalStore` pattern from `ShowCountdown.tsx` verbatim. Tracked as a P1 in
`.agent/memory/project/backlog.md`, not closed by this milestone.

---

## Verification / re-running

```bash
python3 execution/contract.py gate contracts/m2-next16-upgrade.yaml --phase 4 --run-checks
```

Two ordering requirements, both enforced by the contract's assertion file order (`contract.py`
runs phase assertions sequentially, in file order) but worth stating explicitly for anyone
re-running checks by hand:

- **`A13` (build) must run before `A14` (server start).** Never run `pnpm build` while a dev
  server from this suite is up — `next build` and `next dev` share `.next`, and a concurrent
  build corrupts the running dev server's asset manifest. `contracts/checks/m2-next16-upgrade/server-ctl.sh`
  refuses to start if it detects a `next build` process still running, as a best-effort guard.
- **The dev server must run on port 3333**, not the project's usual `3002` (`pnpm dev` hardcodes
  3002). Port 3333 is the only origin currently whitelisted in Sanity project `26yfbug4`'s CORS
  settings — use `next dev --port 3333` for any manual Studio/route check, or
  `contracts/checks/m2-next16-upgrade/server-ctl.sh start` for the automated battery.

---

## Honest limits — read this before citing M2 as "done"

- **The live-route claim is 59 routes verified, not "all 62".** Three routes are
  compiled-and-present only, with no Sanity document to render against them, so they were never
  actually requested with a 200 response during this pass:
  - `/events/[slug]` — 0 of 18 `societyEvent` documents have a `slug`.
  - `/national-show/archive/[year]` — no `nationalShow` document has a populated `year`.
  - `/api/events/[slug]/ics` — same missing-slug dependency.

  This is the F6 content gap (see mission feature F6), not a code defect — `contracts/checks/m2-next16-upgrade/resolve-slugs.mjs`
  looks up a real slug/year from the live dataset and the check self-reports `SKIPPED` rather
  than faking a pass when none exists (`check-routes.mjs:82-99`). `/societies/[slug]` **is**
  live-verified — all 21 society documents have slugs. Nobody should later cite "all 62 routes
  live-verified" against this contract; the true figure this pass established is 59.

- **`SANITY_REVALIDATE_SECRET` is empty in `.env.local`**, so the correct-secret sub-checks for
  both `/api/draft` and `/api/revalidate` self-report `SKIPPED` (`check-routes.mjs:288`,
  `:316`) — and **a `SKIPPED` line still counts toward the assertion's overall PASS**, because
  the assertion is "every check in this category passes or is a declared skip," not "every
  check ran." The `revalidateTag(..., 'max')` code path (the actual F1 fix, `A7`) was verified
  manually instead, with a temporary in-process secret: `{"ok":true,"revalidated":true,"type":"society"}`,
  HTTP 200, no runtime errors. That manual check is **not** re-run by the automated gate, and
  will silently keep skipping on every future `gate --run-checks` invocation until
  `SANITY_REVALIDATE_SECRET` is set locally.

- **M2 green does not mean Sanity Studio works.** It means the upgrade is clean and nothing else
  on the site regressed — `A16` only proves `/studio` returns HTTP 200 with no SSR error digest
  in the response body, not that the document edit pane renders its fields. Whether the editor
  actually works (RF-11's replacement) is F5, scoped to milestone M3, and is only verifiable in
  a live browser, not from source or from this contract.

## Assertion-design lessons

Two checks in this contract initially proved nothing about the system, only about themselves:

- **`A4`** originally used `require()` inside a `.mjs` (ESM) file, so it failed on its own
  module-format mismatch rather than on the thing it was meant to test (whether the vendored
  React exports `useEffectEvent`). Rewritten with `createRequire(import.meta.url)` so the
  `require()` call is valid ESM interop and the check can actually fail for the right reason.
- **`A13`** originally used `grep -qF "$route" "$LOG"` — a substring match. `"/"` matches every
  route line in the build manifest, and `/societies` matches via `/societies/[slug]`, so the
  check could not fail even with a route deleted. Rewritten to extract exact route tokens from
  the manifest's box-drawing tree output and compare with `grep -qxF` (exact-line match); it now
  provably fails (exit 1) when a route line is deleted from the build log
  (`check-build-route-list.sh --check-log <path>` self-test mode).

Both were caught by negative control: running the check against known-broken input and
confirming it fails for the right reason, not just that it fails. **A check that cannot fail
when the system is broken is not a check.** `node --check` / `bash -n` prove only that a script
parses — never that it works.
