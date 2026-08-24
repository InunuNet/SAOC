# door-checkin-one-handed — F1 layout spec

## Structural requirement

`components/admin/DoorScannerClient.tsx`'s returned JSX must satisfy all of the following.
Exact class names are illustrative, not mandatory — @dev may use any Tailwind utilities
that satisfy the *structural* guarantee, but the guarantee itself is not negotiable:

1. **Root container**: `min-h-dvh` (or equivalent `dvh`-based height), `flex flex-col`.
   No `min-h-screen`, `h-screen`, bare `vh`/`vw`, or `100vh`/`100vw` anywhere in this file.
2. **Two structural regions inside the root, in this order**:
   - **Scrollable/flexible upper region**: eyebrow + `<h1>` + camera box (`#qr-reader` +
     status/retry/torch UI). Must be `flex-1 min-h-0` so it is allowed to shrink and, if
     its content overflows, scroll *internally* (`overflow-y-auto`) — it must never force
     the outer page to scroll.
   - **Pinned lower region**: the manual-entry form (label + input + "Check In" button).
     Must be `flex-none` (or otherwise excluded from the scrollable region) so it always
     renders fully inside the visible viewport, below the upper region, never clipped and
     never requiring scroll to reach.
3. The manual-entry form must NOT be a descendant of any element carrying
   `overflow-y-auto`/`overflow-y-scroll`/`overflow-auto`/`overflow-scroll` — that would let
   it be scrolled out of view along with the camera content, defeating the fix.
4. `DoorResultBanner`'s mount point is unaffected — it already renders as a `fixed inset-0`
   overlay outside normal flow, so its position in the JSX tree relative to the two regions
   above doesn't matter functionally, but it must still compile/render (regression guard).
5. `app/admin/door/page.tsx` must still pass `variant="minimal"` to `<AdminNav>` (regression
   guard — this fix must not touch nav variant).

## Verification viewports

Real Android Chrome hides its address bar as the page loads/scrolls, so its worst-case
(smallest) visible height is smaller than a naive `375x667`/`320x568` full-viewport
screenshot would suggest. Playwright cannot simulate the address-bar show/hide directly, so
BrowserAgent verification must treat the full nominal viewport height as the credible
worst case and prove the Check In button is inside it with zero scroll needed — passing
here is the strongest available proxy for passing on real hardware with browser chrome
visible.

Required BrowserAgent passes (both widths, headless is fine, real rendered screenshots
required — DOM presence alone does not satisfy this):

- **375×667** (e.g. iPhone SE-class / small Android viewport)
- **320×568** (smallest realistic mobile width still in use)

At each viewport, capture:

1. **AFTER (mandatory)**: load `/admin/door` in an authenticated admin session (or the
   closest practical stand-in the project's existing BrowserAgent auth pattern supports —
   see how `admin-settings-deploy-and-chrome-fix` and `door-checkin-success-feedback`
   authenticated their BrowserAgent passes), at that viewport, with **no scroll performed**,
   and screenshot the full viewport. Confirm via the screenshot AND a script-read
   `getBoundingClientRect()` on the "Check In" submit button that:
   - The button's bounding box is fully within `[0, viewportHeight]` (i.e.
     `rect.bottom <= viewportHeight` and `rect.top >= 0`).
   - `document.scrollingElement.scrollHeight <= document.scrollingElement.clientHeight + 1`
     (allow 1px rounding) — i.e. the page does not need to scroll at all, OR if the upper
     region legitimately scrolls internally, the outer page-level scroll height still does
     not exceed the viewport.
2. **BEFORE (best-effort)**: if trivial to capture against the pre-fix code (e.g. via git
   stash / a throwaway checkout), the same screenshot + bounding-box check showing the
   defect — `rect.bottom > viewportHeight`. Document this in the QA/BrowserAgent report even
   if only described rather than captured, since the defect is already independently
   confirmed by Brad; this is corroborating evidence, not the primary proof obligation.

Pass condition: **AFTER** passes at both 375×667 and 320×568. This is the only proof that
matters for closing the mission — the BEFORE capture is documentation, not a gate.

## What "thumb-reachable" means here (design intent, not a numeric check)

The button sits in the pinned lower region at the bottom of the viewport by construction —
that satisfies "thumb-reachable one-handed" for a phone held in a standard grip, without
needing a separate quantitative thumb-zone check.
