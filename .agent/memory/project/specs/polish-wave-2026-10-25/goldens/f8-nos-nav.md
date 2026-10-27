# F8 — NOS nav consistency (NV-1). AR-1 dropped.

AR-1 already exists: getVisibleNav() (lib/data/past-shows-public.ts:27-29) removes "Past shows" while showPastShowsRoute() is false, and every NOS chrome
and sub-nav surface reads it (NosFrame, national-show/layout.tsx, NosHero). No surface bypasses it (grep of app/, components/, lib/).

## Root cause (measured, not hypothesised)
The nav is one source on every route. The difference is WHEN it is evaluated. `withholdPlaceholderProse()` reads SHOW_PLACEHOLDER_PREVIEW and the wall
credentials from process.env. A NOS page with no `revalidate` is prerendered once at build, when those runtime-only variables are absent, so the public
nav (5 items) is frozen into it. Siblings with `export const revalidate = 60` (vendors, archive, exhibitors, ...) regenerate at runtime and show 6.
/vendors/apply has no revalidate and no data fetch of its own, so it is fully static: build output `○ /national-show/vendors/apply` with no revalidate
column, versus `1m` on /vendors. Reproduced hermetically: public build, `next start` with preview env at runtime only, wait past 60s, request twice:
/vendors/apply lacks "Past shows"; every other probed route has it.

## Specification (one line)
Add `export const revalidate = 60;` to app/(nos)/national-show/layout.tsx. A layout's segment config applies to every page beneath it, so this gives
/vendors/apply (and any other static NOS page) the same 60s ISR window as its siblings, with the same runtime preview signal. Verified: with that single line
the build lists `/national-show/vendors/apply 1m` and f8-nos-nav-consistency.mjs passes. Do NOT edit app/(nos)/national-show/vendors/apply/page.tsx
(NOS Site PR #76 owns its hero) and do not touch NosFrame, getVisibleNav, the nav data, the programme/tickets card component, /exhibitors or the
symposium presenter builder (NOS Site's). If the one-line change does not produce `1m` for /vendors/apply on your build, stop and report; do not widen.

## Limits
The root not-found page has no <header> element in preview or public mode, so it is not part of the consistency check; its chrome agrees with the live routes
per the audit measurements. The check takes ~90s because it must wait out the 60s ISR window.

## Checks
f8-nav-static.mjs (layout line present, apply page untouched, getVisibleNav intact), f8-nos-nav-consistency.mjs (public build, preview runtime, 9 NOS routes, same
header link list and "Past shows" present on every one). Baseline red on /vendors/apply only.
