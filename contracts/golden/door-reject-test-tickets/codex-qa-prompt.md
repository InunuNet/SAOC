# Codex adversarial review: door rejects test-mode tickets (F4, SEC-06)

Review the diff of branch fix/door-reject-test-tickets against origin/main in this worktree (run in the worktree, not the primary checkout).
Spec: .agent/memory/project/specs/door-reject-test-tickets/spec.md. Goldens: contracts/golden/door-reject-test-tickets/.

Try to break these claims. Report PASS on line 1 only if all hold; otherwise FAIL then findings with file:line.

1. After TICKETING_PAYMENTS_LIVE is flipped, a ticket with no issuedInTestMode field, or null, 0, "false", {}, [], or true, is refused at the door (HTTP 403, code test_ticket) before any status, day or write logic. Only the literal boolean false is admitted. Look for a truthiness check, a default, a cast, or a toTicket() projection that hides a missing field.
2. No creation path can stamp false while a payment adapter is still sandbox-only. Check lib/ticket-issuance-mode.ts, both builders in lib/checkout-reservation.ts, createOrderWithPosition in lib/orders.ts, the comp route, and any other place that writes to the orders or tickets collections (grep app/ and lib/ for .collection('tickets') and 'orders' writes). A creation path that bypasses isIssuanceTestMode() is a FAIL.
3. A real order created after a full go-live carries literal false on the order and on every ticket, with no undefined own-property, and settlement (lib/tickets-notification.ts, markOrderAndPositionPaidByPaymentId) never rewrites the marker.
4. A caller, QR payload or scan request cannot choose liveMode or the marker.
5. lib/payments/** and the TICKETING_PAYMENTS_LIVE constant are unchanged; no backfill script or prod write was added.
6. contracts/checks/door-reject-test-tickets/mutation.mjs genuinely kills each mutant (read it; do the mutants hit the lines that matter?). Name any behaviour the tests would not catch.
7. Merge hygiene: lib/checkout-reservation.ts has only the F4 hunks listed in the spec so F3 (fix/sec-abuse-controls) merges cleanly.

Be adversarial about launch-day sequencing: what exact sequence of flips admits a sandbox-paid ticket?
