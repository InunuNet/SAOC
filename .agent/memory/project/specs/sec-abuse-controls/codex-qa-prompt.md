# Adversarial review: sec-abuse-controls (mission nos-security-tiered-access, M1/F3)

You are reviewing an implementation diff against a frozen design. Read these in the repo you are run in (the PR worktree; do not read any other checkout):
- `.agent/memory/project/specs/sec-abuse-controls/spec.md` (decisions D1-D8, Specification, Interactions)
- the goldens in `.agent/memory/project/specs/sec-abuse-controls/goldens/`
- `git diff origin/main...HEAD`

Try to break it. For each item, answer PASS or FAIL with file:line evidence. Output line 1 exactly `PASS` or `FAIL`, then findings.

1. Race and correctness of the hold budget: is the held-seat read inside the SAME transaction as the write in `reserveTicket`, after the idempotent-replay branch, before `writeMultiReservationPair`? Can two concurrent requests from one actor both pass a nearly-full budget? Can a replay of an existing key be refused? Is an expired or paid position ever counted as held, or a live one missed (compare `stillHoldsSeat` in `lib/data/tickets.ts`)?
2. Limiter bypass: can any shared-lane route still reach the work (request.json, Sanity, Firestore write, email) without passing `consumeAbuseLimit` first? Can a client choose its own key (header, body, case, whitespace, unicode, plus-addressing of the buyer email) to dodge the per-actor or per-buyer limit or to lock out another user? Does the actor key use the second-to-last hop of X-Forwarded-For and ignore a forged leading hop? Is IPv6 grouped to /64 and IPv4-mapped handled?
3. Fail-closed: does every path where the limiter throws (store down, missing secret) refuse the request, never allow it? Is any error swallowed into "allowed"?
4. Privacy: is any raw IP or email written to Firestore or logs by the limiter or the order stamp? Is the hash keyed?
5. Webhook cap: both handlers call `readCappedBody` before `verifyNotification`; no other `request.text()/json()/formData()` precedes it on the four ITN routes; a missing or lying Content-Length cannot bypass; the stream is cancelled; a worst-case legitimate PayFast or Ozow notification (see D6) is accepted. Does a 413 change what a gateway sees for a valid notification?
6. Legitimate purchase and settlement unaffected: `lib/payments/**`, `lib/orders.ts`, `lib/tickets-constants.ts`, `proxy.ts`, `apphosting.yaml` and the reconcile route are unchanged; a 20-seat cart and a second 20-seat cart inside 30 minutes from one buyer succeed; a settled/Pending order flow still works.
7. Firestore undefined-write rule: no `undefined` own-property reaches a write (builders, limiter doc).
8. Lanes and copy: no SAOC-lane file touched except the allowed `lib/vendor-stand-payment-notification.ts`; no new customer-facing sentence invented (the 429 body must be the existing `Too many attempts. Please try again later.`).
9. Goldens: do the frozen goldens actually test what the spec says, or can a wrong implementation pass them? Name any weak golden.
10. Expiry rule: `lib/seat-holds.ts` preserves the exact old `stillHoldsSeat` semantics (paid never expires; reserved with a past expiresAt does not hold; missing or non-timestamp expiresAt still holds). `lib/data/tickets.ts` has no private copy left and both ledger functions use it. Nothing writes to stale `reserved` documents. F3 does not read or change Ozow sandbox mode (`ozowSandboxTestMode`).
11. Anything else that lets an unauthenticated caller hold seats, exhaust Firestore or Sanity, or read a body unbounded on a route this change touches.

FAIL on any confirmed defect in items 1-8, or a golden weakness that lets a wrong implementation pass.
