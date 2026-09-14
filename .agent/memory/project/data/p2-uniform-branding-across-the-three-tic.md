# p2-uniform-branding-across-the-three-tic

**[P2] Uniform branding across the three ticket surfaces** — confirmation page, downloaded
  artifact, confirmation email. All three are currently plain/unstyled with no SAOC identity.
  BLOCKED on Brad's template. Email has a hard constraint the others don't: clients strip `<style>`
  blocks, ignore most modern CSS, and Gmail clips over ~102KB — so table layout, inline styles, and
  a logo delivered as a CID attachment the same way the QR fix will be.
  nothing sets it, `components/admin/StatusPill.tsx` has no style for it (renders through the
  neutral fallback, indistinguishable from an unrecognised status), and no gateway refund call
  exists. A refund today means refunding in the gateway dashboard and hand-editing Firestore with
  nothing linking the two. PayFast exposes a Refunds API (same MD5+passphrase auth as the ITN), so
  this is buildable. Needed before high refund volume.
  a colliding `bookingRef` silently overwrites instead of failing. **Verified 2026-08-21: the main
  checkout path no longer uses this** — `buildMultiReservationDocs()`/`writeMultiReservationPair()`
  (multi-line-item-cart mission) use `transaction.create()` (fail-loud on collision), confirmed by
  reading the code. `createOrderWithPosition()` is now ONLY used by the admin comp-ticket route
  (`app/api/admin/tickets/comp/route.ts`) — narrower blast radius than originally scoped, still a
  real gap there, lower urgency (comp tickets are a low-volume admin action, not public checkout).
  and `Ticket`**, deliberately, and nothing detects divergence between the copies. **Confirmed still
  true 2026-08-21** against a real live purchase (both fields present and populated on the order
  doc and on each of its two position docs). The position copies were meant to be removed with a
  backfill once checkout/ITN stop writing them.
  is called in checkout (`app/api/tickets/checkout/route.ts:739`) and `recoveryToken`/
  `recoveryTokenExpiresAt` are confirmed present on a real order doc. Still genuinely open: the
  guest-order-claiming backfill (a guest's existing orders' `buyerUid` backfilled when they later
  register) — not re-verified, may still be owned by nobody.
  council-approved value. Real security/usability tradeoff: too short locks buyers out of tickets
  they paid for, too long keeps a leaked link live for months.
  wired (`app/api/admin/checkin/route.ts:60` → `recordCheckinAttempt`), but the paused mission
  `prove-ticket-purchase-works-end-to-end-b` M1 gate observed no document after a live scan.
  Agent-actionable: query Firestore directly, do not queue a human scan. If the write genuinely
  fails, it fails silently — `lib/checkin-audit.ts:143` logs and swallows. Must survive the Stage 5
  per-day check-in rewrite: re-verify after it lands.
  **DONE 2026-08-25** — built read-only `scripts/verify-checkin-audit-write.ts`, cross-referencing
  checked-in tickets against `checkinAttempts` admit records (bookingRef-primary join, orderId
  fallback). Live run against real Firestore (verified twice): 0 orphans — the write path works
  correctly right now. No production code changed; a regression-locked verification tool now
  exists for future checks. Gate 6/6 pass, QA + Codex GPT-5.5 found and fixed 3 real bugs in the
  script's own join logic mid-mission. See `docs/verify-checkin-audit-write.md`.
  retired `'general' | 'member' | 'vip'` union and a 6-digit `bookingRef`. Reality: free-form
  string keyed by Sanity slug, 60-bit Crockford base32 refs.
