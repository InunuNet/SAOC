# p2-day-visitor-s-chosen-day-is-not-shown

**[P2] Day Visitor's chosen day is not shown on the ticket confirmation page.** Verified
  2026-08-21: `chosenDay` is correctly captured and persisted (`"2027-09-18"` confirmed in
  Firestore against a real purchase), but `/tickets/confirmation` only shows
  "day-visitor · R150.00" — no date. A buyer has no way to see which day they're confirmed for
  after checkout. Minor completeness gap in F5 (ticketing-f5-day-attendees), not a data-loss bug.
