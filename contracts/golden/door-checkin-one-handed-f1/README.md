# door-checkin-one-handed — F1 golden spec

## The defect (confirmed live by Brad operating the scanner himself)

`components/admin/DoorScannerClient.tsx` renders, in plain document flow inside a
`min-h-screen` wrapper:

1. `<span className="eyebrow">SAOC</span>` + `<h1>Door Check-in</h1>`
2. The camera box (`#qr-reader` — html5-qrcode injects its own video element, and on some
   devices/browsers a camera-picker `<select>`, into this box; its rendered height is not
   fully within our control) plus camera-status copy / retry button / torch button
3. The manual-entry form (input + the "Check In" submit button)
4. `DoorResultBanner`, now a fixed full-viewport overlay (already fixed by
   `door-checkin-success-feedback` — untouched here)

Stacked in normal flow, (1)+(2)+(3) exceed the real visible height of an Android Chrome
viewport at 375×667 and 320×568. The manual-entry "Check In" button — item (3) — renders
below the fold: on Brad's device only the top ~8px of the button cleared the browser's
system nav bar. An operator scanning tickets one-handed at the door cannot reach it
without scrolling first, which is not a one-handed-safe motion mid-scan.

`min-h-screen` is also the wrong unit family here: Tailwind's `screen` utility is `100vh`,
and `vh` is sized to the *largest possible* viewport (address bar hidden). Mobile Chrome
shows/hides its address bar as the user scrolls, so `100vh` under-reports how much of the
page is actually hidden below the *currently visible* viewport — exactly the class of bug
`door-checkin-success-feedback` already fixed once in `DoorResultBanner.tsx` by switching
to `dvh`/`dvw`. This contract applies the same fix to the container `DoorResultBanner`
lives inside.

## Root cause

Pure layout bug, not a rendering-logic bug: every element renders correctly and in the
right order. The container gives the page no viewport height *budget* — nothing caps how
tall the camera box + heading + manual-entry form are allowed to grow, and nothing pins
the manual-entry form (the primary action) to a location guaranteed to stay inside the
visible viewport. Content simply grows until it needs scrolling, and the primary action
sits at the bottom of that overgrown flow.

## Fix direction (binding on @dev)

Restructure `components/admin/DoorScannerClient.tsx`'s root layout as a `dvh`-budgeted
flex column, per `layout-spec.golden.md`, so:

- The root container is exactly one dvh-tall viewport (`min-h-dvh` — never bare `vh`/
  `min-h-screen`/`h-screen`), laid out `flex flex-col`.
- The manual-entry form (containing the "Check In" button) is **never** inside a
  scrollable region and is **not** at the mercy of how tall the camera box happens to
  render — it must be structurally guaranteed to sit inside the visible viewport at
  375×667 and 320×568, with no page-level scroll required to reach it.
- If the heading + camera box content is too tall to fit above the manual-entry form at
  the smallest supported viewport, that region — and *only* that region — may scroll
  internally (`overflow-y-auto` on a `flex-1 min-h-0` element). The page itself must never
  need scrolling to reach the Check In button.
- `AdminNav` on this route stays `variant="minimal"` (`app/admin/door/page.tsx`) — do not
  change this prop or introduce a persistent bar; a minimal trigger is already
  near-zero vertical footprint and is not the cause of this defect.
- `DoorResultBanner.tsx`, `app/api/admin/checkin/route.ts`, and the camera
  start/stop/torch lifecycle logic are untouched — this is a container-layout fix only.

## Scope boundaries — this feature touches exactly

- EDIT `components/admin/DoorScannerClient.tsx` — root container restructured to a
  dvh-budgeted flex column per `layout-spec.golden.md`. No new brand colors/tokens. No
  change to the camera lifecycle (`beginScan`, torch, retry), `handleCheckIn`, or the
  `CheckInResult` shape.
- NOT touched: `app/admin/door/page.tsx` (nav variant already correct — verified by A2 as
  a regression guard, not a change target), `components/admin/DoorResultBanner.tsx`
  (already dvh-correct), `components/admin/AdminNav.tsx`, `app/api/admin/checkin/route.ts`.

## What this contract does NOT do

- Does not change the camera scanning logic, torch handling, or error classification.
- Does not change `DoorResultBanner`'s overlay behavior (already fixed).
- Does not add a new nav variant or touch `AdminNav.tsx`.
- Does not attempt to detect/compensate for a specific device's on-screen nav bar height
  programmatically — the fix must work by construction (dvh + pinned-bottom flex layout),
  not by hardcoding a magic-number offset for one device.
