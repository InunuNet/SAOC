# p1-verify-the-reserved-seat-release-path

**[P1] Verify the reserved-seat release path actually fires.** `buildReservationDocs` now
  writes `expiresAt` onto the position document as well as the order (`lib/checkout-reservation.ts`
  lines 56 and 81), which was the missing field that made lazy expiry-release unreachable — every
  reserved position hit the "no `expiresAt` → fail closed" branch unconditionally, so
  `RESERVATION_TTL_MINUTES = 30` was inert and abandoned carts held capacity forever. **The write
  is fixed; the release path itself has still never been observed running.** Verify it, do not
  assume. Note the interaction: once seats DO release, a paid-but-stranded order's seat becomes
  resellable. Also note what this episode showed — the no-oversell WRITE path is genuinely well
  proven (5 concurrent requests at the last seat, real server, real Firestore) while nothing
  verified the RELEASE path, which is where the defect sat.
