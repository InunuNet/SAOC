# Golden spec: door check-in result overlay

Structural requirements a passing implementation must satisfy. Referenced by
`contracts/checks/door-checkin-success-feedback-f1/*`.

## Positioning (both success and failure)

- The element that wraps the result banner content carries `fixed` positioning classes plus
  `inset-0` (or equivalent full-coverage box: top/right/bottom/left all 0) — Tailwind: `fixed
  inset-0`.
- Height/width sizing anywhere in the same component uses `dvh`/`dvw`-based units if any
  explicit viewport-relative sizing is present (not bare `vh`/`vw`) — matches this project's
  existing mobile-viewport-height convention.
- A z-index utility class is present on the overlay (e.g. `z-50`) so it stacks above the
  scanner box and manual-entry form.

## Success branch tokens (no new colors)

- Background: `bg-primary`.
- Text: `text-ivory`.
- No hex literal, `rgb(`, or new Tailwind color utility outside the existing
  primary/primary-800/primary-700/primary-100/accent/accent-soft/parchment/ivory/bone/ink/rule
  family appears in the diff.
- A checkmark glyph or icon is present, sized larger than the pre-fix `text-[22px]`/`text-[26px]`
  treatment (e.g. `text-[48px]` or larger, or an SVG/icon element).
- Attendee name (`result.ticket.attendeeName`) still rendered.
- `role="status"` preserved.

## Failure branch tokens (no new colors)

- Background: `bg-bone`.
- Border/text: `border-primary-800` / `text-primary-800` (the existing accessible pairing).
- `role="alert"` preserved.
- `result.error` (the specific refusal reason) still rendered.

## Behavior

- On a successful check-in, the overlay auto-dismisses (clears `result` to `null`) after a
  fixed delay, implemented with a cleanup-safe timer (cleared on unmount / on a new result
  arriving before the timer fires — no stale `setResult(null)` firing after a newer scan already
  replaced it).
- On a failed check-in, no auto-dismiss timer is set — the overlay holds until overwritten by
  the next scan's result, or until the operator explicitly dismisses it (a visible "Dismiss"
  button, min 44px touch target, plus tap-anywhere-on-overlay as a secondary affordance — added
  post-Codex-review, F1 follow-up, to close a usability lockout where manual entry/retry/camera
  were unreachable until the next scan). This is a manual clear via the same `setResult(null)`
  path success's timer uses, not an auto-dismiss timer — the "no auto-dismiss timer" rule above
  is unchanged.
- The underlying camera scanning loop is never stopped or restarted by a result being set or
  cleared — `beginScan`'s lifecycle stays independent of `result` state.

## Non-goals (explicitly do not check for these — see README "What this contract does NOT do")

- Any change to the Check In button's own position or the page's overall thumb-reach layout.
- Any new color token added to `app/globals.css`.
- Any change to `CheckInResult`'s failure shape (no `bookingRef` added to the failure variant).
