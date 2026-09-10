# p1-door-check-in-the-successful-scan-pro

**[P1] Door check-in: the successful scan produces no visible feedback.** Brad's live mobile
  test — the scan WORKED (ticket reached `checked-in`, duplicates correctly refused) and the UI
  showed him nothing. Leading hypothesis, unverified: the result panel renders below the fold, same
  as the "Check In" button, so on the first successful scan the confirmation rendered off-screen.
  If so, "no feedback" and "below the fold" are ONE defect. **Rule out in this order before
  designing:** (1) does the admitted state render at all, or only the failure/duplicate branches;
  (2) if it renders, does it persist or is it cleared when the scanner loop resumes; (3) where does
  it land relative to the viewport at 375px and 320px immediately after a scan.
  **Brad's required behaviour, explicit:** SUCCESS is visually assertive and unmistakable at a
  glance, then the page RESETS clearing the previous ref so the next person can be scanned.
  FAILURE HOLDS the entered reference for inspection, with a bright red "Check-in not accepted"
  AND the specific reason — already checked in / unpaid / wrong show / unknown reference — because
  the reason determines the steward's next action. Blocked on the semantic-colour decision above.
  Accessibility: colour alone must not carry the verdict; pair with icon and text, meet contrast on
  parchment, assume a colour-blind steward in bright sunlight.
  Verify on a real phone with a real unscanned ticket — a DOM assertion cannot see this, and the
  existing suite never asserted that a successful scan shows the operator anything.
  `[verify against new brief]` — the verdict taxonomy changes when check-in becomes per-day.
