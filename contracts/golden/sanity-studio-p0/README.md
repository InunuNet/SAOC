# sanity-studio-p0 — golden facts

Scope: two independent P0 bugs, confirmed live on 2026-07-28 against
`pnpm dev` on port 3002 (the port `package.json`'s `dev` script hardcodes).

## Bug A — dev-mode SSR crash on every /studio request

Reproduced directly: `GET /studio` returns HTTP 200 (Next swallows the SSR
error and falls back to client rendering) but the dev server log logs, on
every single request:

```
Invalid hook call. Hooks can only be called inside of the body of a function component. ...
 ⨯ [TypeError: Cannot read properties of null (reading 'useSyncExternalStore')] {
  digest: '1606006146'
}
```

Critically, Next also embeds the failure into the RSC flight payload sent to
the browser, as a literal substring of the response body:

```
Switched to client rendering because the server rendering errored:

Cannot read properties of null (reading 'useSyncExternalStore')
```

This string is the most reliable fix-verification signal available: it can
only appear if the SSR pass for `/studio` threw. Its absence from the
response body, combined with a clean dev log, is what the contract's dynamic
Bug A assertion checks for. This does not prescribe HOW the crash is fixed
(webpack externals config, dependency reshuffle, etc.) — only that it stops
happening while `pnpm build` still succeeds.

### `next.config.ts` history (context for @dev, not a fix prescription)

- `b3e71b1` (Phase 1 scaffold): no `serverExternalPackages`, no webpack hook.
- `2b8b543` (Phase A3, Sanity install): added
  `serverExternalPackages: ['sanity', 'next-sanity', '@sanity/vision']`
  *and*, in the same commit, a `webpack.module.parser.javascript.exportsPresence
  = false` override, comment-documented as working around Sanity 5.x's
  `useEffectEvent` static-export-analysis false positive (an unrelated,
  already-understood problem — see the comment already in `next.config.ts`).
  There is no comment or commit message explaining *why*
  `serverExternalPackages` specifically was added at the same time; no prior
  attempt/revert is visible in history to indicate it was fixing a previously
  observed bundling failure. It landed as part of the initial Sanity
  integration, most plausibly cargo-culted from Sanity/Next.js integration
  docs (this is the standard recommended snippet for Sanity + Next.js App
  Router setups) rather than as a targeted fix for an observed local issue.
- `bea4f1e` (housekeeping): unrelated `outputFileTracingRoot` addition, no
  change to `serverExternalPackages`.

Since `serverExternalPackages` is the prime suspect for Bug A (it forces
`sanity`/`next-sanity`/`@sanity/vision` to load via native `require()`
outside Next's client-boundary handling during SSR — the documented failure
class behind `sanity-io/next-sanity#707`, `sanity-io/sanity#2819`, and
`vercel/next.js` discussion #70487), removing or narrowing it is a reasonable
starting point. But because there's no recorded evidence for why it was
added, @dev must verify the production build still succeeds and still ships
`/studio` after any change here — hence this contract gates the *outcome*
(dev renders clean, prod build still green) rather than a specific edit to
`next.config.ts`.

## Bug B — marketing chrome leaks onto /studio

Reproduced directly: the `/studio` response body (still, even independent of
whether Bug A is fixed) contains all three chrome markers below, verbatim
from `app/layout.tsx` unconditionally rendering
`<UtilityBar /><Header /><main>{children}</main><Footer />` for every route,
with `app/(marketing)/layout.tsx` a no-op passthrough.

## Stable grep markers (confirmed present in current rendered HTML)

| Component | Marker string | Source |
|---|---|---|
| UtilityBar | `mailto:council@saoc.co.za` | `components/chrome/UtilityBar.tsx` |
| Header | `sticky top-0 z-40` | `components/chrome/Header.tsx` (root `<header>` className) |
| Footer | `bg-primary-800 text-ivory` | `components/chrome/Footer.tsx` (root `<footer>` className) — also present on UtilityBar's outer div, which is fine: it should be absent from `/studio` and present on `/` either way |

Fix shape (per @architect's mission brief): move
`<UtilityBar /><Header /><main>{children}</main><Footer />` into
`app/(marketing)/layout.tsx`; `app/layout.tsx` keeps only `html`/`body`,
fonts, and `globals.css`.

## Explicitly out of scope (do not fold into this fix)

- Sanity account/project membership issues.
- Sanity Studio CORS configuration.
- The Sanity v5→v6 major upgrade.
- The pre-existing repo-wide `pnpm lint` failure caused by ESLint linting
  the gitignored `Old SAOC Website Backup/` legacy Joomla directory (not
  excluded in `eslint.config.mjs`'s `ignores` list). Confirmed still present
  as of this contract's authoring — same precedent as
  `contracts/contract-sanity-react-peer-fix.yaml`'s `RF-07`..`RF-09` note.
  `pnpm lint` is deliberately NOT a gate assertion here.
