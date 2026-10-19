# F31 live sandbox protocol - all six Ozow picker outcomes on beta

Run after F31 is deployed to beta. Records evidence; it does not change code. Sandbox only (Ozow `IsTest=true`), fictional test show, cheapest ticket. Never print secrets. Read inbox with the read-only `gws` CLI only (skill `gws-gmail`), never the Google connectors.

## Precondition
- Ozow is the active gateway and the sandbox test-mode amount toggle is as Brad left it (`adminSettings/ozowSandboxTestMode`; record it, do not change it).
- A test buyer mailbox readable by `gws` (read-only).
- Capture, for each run, before and after: order doc (`orders` by reference), its positions, and the capacity count for that ticket type (sold-count badge on `/tickets` or `getSoldCountsByTicketType`). Use read-only Admin SDK reads or the admin UI; no writes.

## Procedure (six runs, one purchase each; each is a fresh cart for the cheapest ticket)
For each button in the order Successful, Cancelled, Error, Abandoned, Pending investigation, Pending:
1. Buy 1 cheapest ticket (Playwright or by hand), proceed to Ozow, click exactly that picker button once. Note the URL the browser lands on.
2. Within 2 minutes record R1: order `status`, `gatewayPending`, `expiresAt`, position statuses and `expiresAt`, capacity count, the page and heading shown (screenshot), the poller state at 70 s.
3. Check the inbox via `gws` for any email to the buyer and admin recipients since the click. Record subject and time, or "none".
4. Cloud Logging: the `/api/tickets/ozow-itn` log line for that reference (status mapped, branch taken). No payloads.
5. For Pending and Pending investigation only, record R2 at original-expiry + 5 minutes (about 35 min after purchase): capacity count must still include the seat and `expiresAt` must still be about 72 h out.
6. For the three non-paying negatives (Cancelled, Error, Abandoned) record R3 at original-expiry + 5 minutes: capacity count must have dropped by one (seat released), order still `reserved`.

Then repeat the six outcomes once through the vendor stand payment (`/national-show/vendors/payment`, approved test vendor, smallest booth), recording `vendorStandOrders` status, `gatewayPending`, page shown after return, whether re-initiate is refused (Pending outcomes only), and emails (receipt + admin notice only on Successful).

## Expected results (pass criteria)

| Button | Order after 2 min | Seat at expiry+5 | Page | Emails |
|---|---|---|---|---|
| Successful | paid, positions paid | kept | ticket with QR | confirmation, once |
| Cancelled | reserved | released | cancelled page | none |
| Error | reserved | released | cancelled page | none |
| Abandoned | reserved | released | wherever Ozow sends the buyer (record it) | none |
| Pending investigation | reserved + gatewayPending | held (+72 h expiry) | confirming, then taking-longer copy | none |
| Pending | reserved + gatewayPending | held (+72 h expiry) | confirming, then taking-longer copy | none |

Vendor: Successful -> paid + receipt + admin notice; Cancelled/Error -> cancelled/failed, retry allowed; Abandoned -> still pending, retry allowed; Pending / Pending investigation -> pending, retry refused with the "Confirming your payment" notice.

## Resolve a pending order (transition check, once)
Ozow's sandbox cannot be told to complete a Pending later. Prove the transition offline (A2, A3) and, on beta, re-deliver nothing by hand. Record in the report that Pending -> Complete was proved by the offline checks only.

## Output
Write the filled table plus screenshots to `.agent/memory/scratch/f31-live-run/`, and list any observed behaviour that differs from the expected table as a defect, not a note.
