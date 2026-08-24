# Door check-in success feedback — root cause and fix spec

## Root cause (investigated 2026-08-24/25, before any fix was designed)

Backlog item `[P1] Door check-in: the successful scan produces no visible feedback` asked
three questions in order. Answered by reading the actual code (`components/admin/DoorScannerClient.tsx`,
`components/admin/DoorResultBanner.tsx`, `app/api/admin/checkin/route.ts`) — no BrowserAgent
needed for these three, they're answerable from the source:

1. **Does the admitted state render at all?** Yes. `checkInByBookingRef` returns
   `{ success: true, ticket: {...} }` on admit (`app/api/admin/checkin/route.ts:130`), and
   `DoorScannerClient.handleCheckIn` (`components/admin/DoorScannerClient.tsx:49-68`) always
   does `setResult(data)` on the parsed response with no branch that drops the success case.
   `DoorResultBanner` (`components/admin/DoorResultBanner.tsx:25-39`) has a real success branch
   — solid `bg-primary`/`text-ivory` fill, a checkmark glyph, the attendee name, ticket type and
   booking ref. This is not dead code.
2. **Does it persist, or get cleared when the scanner loop resumes?** It persists. Nothing
   clears `result` between scans — `scanningRef.current = false` in `handleCheckIn`'s `finally`
   only unblocks the *next* scan from being accepted; it never touches the `result` state. The
   camera keeps running continuously in the background (the `useEffect` mount/unmount in
   `DoorScannerClient.tsx:97-112` never stops on a result), so a stale banner would only be
   overwritten by the next successful `setResult` call, not silently wiped. **No race/timing
   bug exists.**
3. **Where does it land relative to the viewport at 375px/320px?** Below the fold. `DoorResultBanner`
   is the *last* element in the page's normal document flow (`DoorScannerClient.tsx:210-214`),
   rendered after: the `eyebrow` + `<h1>` header (~70px), the bordered scanner box containing the
   live camera `<video>` element sized to `qrbox: 250x250` plus its container padding (routinely
   300-400px tall on a real device, wider than the QR box itself since `html5-qrcode` letterboxes
   to the camera's native aspect ratio), an optional torch button (~50px when shown), and the full
   manual-entry form (label + input/button row, ~130px with margins). Summed, the content above
   the banner alone comfortably exceeds 375px and 320px viewport heights — often exceeding taller
   phones too — before the banner ever gets laid out. It is real DOM content, not `display:none`,
   just positioned after enough content to push it off-screen with no auto-scroll.

**Verdict: (b) — a pure layout/positioning bug.** The success (and failure) branch renders
correctly and persists correctly; it is simply placed after content tall enough to push it below
the fold on real phone viewports, so the operator never scrolls to it. This is not the same
defect as the sibling P1 backlog item ("Door check-in is not one-handed" — thumb-reach to the
Check In button, `dvh`/`svh` viewport-height layout for the *whole* page), and this contract does
NOT attempt that broader redesign — scope here is strictly the result banner's own visibility.
The fix technique (a full-viewport fixed overlay) happens to also make the *failure* banner
un-missable, which is a welcome side effect, not scope creep — `DoorResultBanner` renders both
branches through one code path and moving one moves both.

## Fix specification (what @dev must implement)

**Mechanism:** the result banner must render as a `position: fixed`, full-viewport overlay
(`inset: 0`, using `dvh`-based sizing per this project's own established convention for
mobile-viewport-height correctness — `vh` is wrong on mobile browser chrome, see the sibling
"not one-handed" backlog item's own instruction) stacked above the scanner UI with a z-index,
**not** a block appended to normal document flow. This guarantees visibility regardless of
scroll position or how tall the content above it happens to be — it does not depend on getting
the scanner box / manual-entry form's combined height right, which is what made this fragile
before. Rendered conditionally (`result && <Overlay .../>`) exactly as today, just not in-flow.

**Visual content (per the mission brief's explicit requirement, and reusing only tokens that
already exist in `app/globals.css` — no new brand colors invented, per this project's
"no invented brand assets" rule and the existing precedent in `DoorResultBanner.tsx`'s own
comment that a semantic bright-green/bright-red palette does not exist and success/failure
reuse `primary`/`primary-800` instead):**

- Success: full-bleed `bg-primary` (`#384138`, deep sage) fill, `text-ivory` — the entire
  overlay, not a bordered card floating on the parchment background. A large checkmark
  (bigger than the current 22-26px text glyph — a dedicated icon or a much larger glyph,
  legible at arm's length in under a second per `DoorResultBanner`'s own existing comment),
  the attendee name in large bold text, ticket type + booking ref below it.
- Failure: same overlay mechanism, `bg-bone`/`border-primary-800`/`text-primary-800` — the
  existing accessible-contrast pairing already used today (this pairing was already chosen
  specifically to avoid the 2.94:1 WCAG failure `text-accent`-on-light produced on the login
  page; do not swap it for something new), a large "✕" and the specific refusal reason text
  (`result.error`, already present — already-checked-in/unpaid/wrong-show/unknown all resolve
  to real distinct strings server-side, see `REFUSAL_CODE_TO_OUTCOME` in
  `app/api/admin/checkin/route.ts`).
- Accessibility unchanged in kind, strengthened in degree: `role="status"` (success) /
  `role="alert"` (failure) preserved; verdict is never color-only — icon glyph AND text label
  both present in both branches, already true today, must remain true.

**Reset-for-next-scan (explicit in the backlog's "required behaviour," reproduced in the mission
brief):** on success, auto-dismiss the overlay after a short fixed delay (this fix uses 3
seconds) — clearing `result` back to `null` — so the screen returns to the live camera view
ready for the next attendee without the operator needing to tap anything. On failure, the
overlay does NOT auto-dismiss — it holds until the next scan (successful or not) produces a new
`result`, giving the steward time to read the reason and decide their next action. This matches
existing behavior for "does it get overwritten by the next scan" (yes, always did) while adding
the new success-only auto-clear.

## What this contract does NOT do

- Does not touch the "not one-handed" thumb-reach / Check In button viewport problem (separate
  P1 backlog item, separate contract).
- Does not add a new semantic color token — deliberately reuses `primary`/`primary-800`/`bone`/
  `ivory`, already-established precedent.
- Does not change `CheckInResult`'s failure shape to carry the raw attempted `bookingRef` for
  display (the backlog phrase "FAILURE HOLDS the entered reference for inspection" arguably also
  wants the manual-entry input to stop clearing itself on failure) — out of scope for this
  specific "success produces no feedback" defect; flag separately if wanted.
