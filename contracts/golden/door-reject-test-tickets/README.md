# Door rejection of test tickets — F1 golden

📋 DECISION: Keep issuance provenance on every order and ticket, and fail closed at
live door admission. This implements the coordinator's decision; no purge, migration,
new launch switch or payment behaviour change is authorised.

🔍 ANALYSIS: Explicit provenance permits new live tickets while refusing all legacy
unmarked tickets. This costs one boolean per document and deliberately rejects legacy
records, even if paid or comped. A purge would destroy test history and is unnecessary.
A truthiness check would admit missing/null/zero values and is prohibited.

## Verified code paths

- `lib/ticketing-test-mode.ts`: `TICKETING_PAYMENTS_LIVE = false` and
  `isTicketingTestMode()` returns its inverse. This same module supplies the testing
  banner treatment. Do not change the constant or remove the banner in this feature.
  The later reviewed launch change activates this guard automatically when it flips
  that existing constant; no second configuration step is needed.
- `app/api/tickets/checkout/route.ts`, `reserveTicket()`: calls
  `buildMultiReservationDocs()` then `writeMultiReservationPair()` inside its transaction.
  `lib/checkout-reservation.ts` constructs the order and each position in
  `buildMultiReservationDocs()`; `buildReservationDocs()` is the single-position sibling.
  Both must stamp both document kinds, including every item of a multi-item cart.
- `lib/orders.ts`, `createOrderWithPosition()`: separately constructs and sets an order
  and ticket. The admin comp route uses `buildCompOrderInput()` then this primitive.
  Comp tickets are not exempt from provenance or live rejection.
- PayFast `app/api/tickets/itn/route.ts` and Ozow `app/api/tickets/ozow-itn/route.ts`
  delegate to `lib/tickets-notification.ts`. It calls
  `markOrderAndPositionPaidByPaymentId()` / `markOrderPaymentPendingByPaymentId()` in
  `lib/orders.ts`. These UPDATE reservations, not create new tickets. Preserve the
  original marker; settlement after launch must never relabel a test reservation as live.
- `app/api/admin/checkin/route.ts` checks `getAdminSession()` before admission.
  `lib/admin-auth.ts` requires a verified session, admin claim, verified email and
  allowlist membership. Preserve this gate; do not add the deferred capability gate.
- The route delegates to `lib/checkin.ts`, whose `admit()` reads and updates inside
  one transaction. Guard the raw snapshot value there, not a cast/defaulted `Ticket`.
  `toTicket()` is a response projection, not a creation builder.
- `components/admin/DoorScannerClient.tsx` passes response JSON to `applyResult()` and
  `DoorResultBanner`; only successful results increment its counter and auto-dismiss.
  `DoorResultBanner.tsx` already displays arbitrary rejection copy with role alert,
  error colours, cross icon and “Not checked in”. Reuse that path. There is no
  non-blocking test-ticket note pattern, so introduce no test-mode note.
- `CLAUDE.md` requires Firestore builders to coalesce or strip undefined own-properties.
  For this field specifically, neither null nor omission is acceptable on new documents.

⚡ SPECIFICATION:

1. At creation, derive `issuedInTestMode` from the server's `isTicketingTestMode()`
   and assign a boolean own-property on BOTH order and each ticket. Prefer one captured
   value per creation operation, shared by the pair/cart. Ignore caller/request markers.
   Keep existing builder call signatures compatible. Update Order/Ticket typing to
   accommodate the field and historical missing data; optional read types are acceptable,
   but every creation output must include the boolean. Do not coerce stored data on read.
2. Add `lib/checkin-test-ticket-guard.ts` exporting
   `decideTestTicketAdmission(input: { issuedInTestMode?: unknown; liveMode: boolean })`
   returning `'allow' | 'reject_test_ticket'`. Pure, no I/O, no clock or global mode reads.
   The service supplies `liveMode: !isTicketingTestMode()` and the raw stored marker.
   Never accept liveMode or provenance from the scan request or QR contents.
3. Decision order: existing auth and booking-reference validation; transaction read;
   not-found; wrong-show; test-ticket guard; already-checked-in; unpaid; admission write.
   In live mode a matching-show test ticket is rejected explicitly even if already used
   or unpaid. In test mode the guard allows and all existing rules retain their behaviour.
   An allow from this guard is not itself admission permission.
4. Add `test_ticket` to CheckinRefusalCode, REFUSALS, CheckinAttemptOutcome and the route's
   exhaustive refusal-to-audit mapping. Response: HTTP 403,
   `{"success":false,"code":"test_ticket","error":"Test ticket — not valid for entry"}`.
   Returning code on other refusals is acceptable and additive. Keep auth responses intact.
   Record exactly one refusal audit via the existing non-blocking mechanism; this audit
   append is allowed, but no ticket/order admission write, checkedInAt mutation or scanner
   counter increment is allowed. Preserve an existing checkedInAt on refusal.
5. Neither settlement, retries nor idempotency replay may stamp existing records with
   a newly computed live provenance. Never backfill missing provenance to false.
   No payment adapters, PayFast code, env/config/secrets, launch constant or banner changes.
   Synthetic seed data with no marker is intentionally invalid in live mode; no seed run
   or live data cleanup is part of this task.

## Exact truth table

`liveMode` means `!isTicketingTestMode()`. “Missing” means the input has no own property;
JSON cannot represent undefined, so the test also supplies explicit undefined separately.

| issuedInTestMode | Test mode (liveMode false) | Live mode (liveMode true) |
| --- | --- | --- |
| true | allow | reject_test_ticket |
| false | allow | allow |
| missing | allow | reject_test_ticket |
| null | allow | reject_test_ticket |
| string "true" | allow | reject_test_ticket |
| string "false" | allow | reject_test_ticket |
| number 0 | allow | reject_test_ticket |
| object {} | allow | reject_test_ticket |
| array [] | allow | reject_test_ticket |
| explicit undefined | allow | reject_test_ticket |

`truth-table.json` is the executable golden input, consumed directly by the test file.
All non-booleans, including values outside the representative fixture, reject in live mode.

## Offline acceptance and handoff

The new unit file is `contracts/checks/door-reject-test-tickets/admission.test.mjs`.
Run `node --test contracts/checks/door-reject-test-tickets/admission.test.mjs`.
There is **no existing unit-test package script** in this checkout; `test:e2e` runs
Playwright, not unit tests. Existing contracts commonly execute Node checks directly.
Do not invent a `pnpm test` command or add a runner dependency. Type-check with the
existing `pnpm type-check` script and lint with local `pnpm exec eslint` as in the contract.
These commands work identically for Claude Code, Gemini CLI and OpenCode.

The test transpiles real source in memory using installed TypeScript, with an explicit
module allowlist. It executes the real POST, service, guard, builders, audit construction
and banner, replacing only external boundaries with in-memory fakes. No SDK is loaded,
no Firestore emulator is required, no network call is made and no environment is read.
A write spy verifies guard execution precedes the admission write. The forged request
fields demonstrate that the service must derive mode and provenance itself. Builder
checks exercise both modes, every multi-item position, absent optional compedBy and
forged/undefined caller provenance. Assertions should be red before implementation.

✅ RATIONALE: Runtime truth-table and route/write tests catch the launch blocker that
source-only greps cannot establish. The existing banner already provides the requested
error display, so a server response change can supply the copy without visual redesign.

➡️ RISKS: Strict schema validation proves contract shape, not feature completion. These
checks do not prove deployed Firestore concurrency, gateway integration, camera behaviour,
or browser layout; they never contact those services. Review must verify settlement
updates preserve provenance and any additional creation paths introduced later also stamp
it. The complete gate has separate repository triad/residue preflights; do not run it or
claim deployment verification from this offline authoring task. During implementation,
run the normal browser/QA workflow separately if UI source is changed. No implementation
or launch approval is implied by this contract.
