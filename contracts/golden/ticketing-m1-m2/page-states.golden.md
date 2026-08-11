# Required page states — F2 `/tickets` and F3 `/tickets/confirmation`

Every heading, message and button label named below is sourced from the `ticketsPage` Sanity
singleton (see `ticketsPage-schema.golden.json` / `seed-ticketing.golden.json`), not a hardcoded
string in the component — the state/trigger logic stays in code, the words visitors read do not.

## `/tickets` (F2)

| State | Trigger | Behaviour |
|---|---|---|
| Loading | route-level Suspense boundary while Sanity/Firestore data is fetched | `app/(marketing)/tickets/loading.tsx` skeleton, Sage & Paper tokens only |
| Sales closed | `nationalShow.salesOpen !== true` | `SalesClosedNotice` renders `salesMessage`; no form, no prices, no PayFast reference at all |
| All types sold out | `salesOpen === true` but every active `ticketType`'s reserved+paid count ≥ capacity | Dignified "sold out" notice, no form |
| Individual type sold out | that type's reserved+paid count ≥ its capacity, other types still open | `TicketTypeCard` renders disabled with a "Sold out" badge, excluded from selection |
| Validation error | attendee name empty, or email fails `EMAIL_PATTERN`, or no ticket type selected | Inline error text under the offending field, `aria-invalid`, submit blocked client-side |
| Submitting | valid form submitted, awaiting `/api/tickets/checkout` response | Submit button disabled + busy state, e.g. "Redirecting to PayFast…" |
| Server error | checkout API returns non-2xx (incl. sales-closed-at-POST-time 403, unknown ticketType 400, 500s) | Error banner (`role="alert"`) with the API's message, form stays editable, no silent failure |
| Redirect | checkout API returns 201 with signed fields | Hidden auto-submitting `<form>` posts straight to PayFast's `processUrl` |

## `/tickets/confirmation` (F3)

| State | Trigger | Behaviour |
|---|---|---|
| Missing/invalid `ref` | no `?ref=` query param, or malformed | "We couldn't find that booking" message, link back to `/tickets` |
| Pending | status endpoint returns `reserved` | Honest "we're waiting for payment confirmation" copy — never phrased as success or failure — with a visible poll/spinner |
| Confirmed | status endpoint returns `paid` or `checked-in` | Clear success state, booking ref shown, no invented "check your email" promise (F5, the emailed ticket, is out of scope for this contract) |
| Still unresolved after max polls | status stays `reserved` past a bounded attempt/time cap | Stop polling, tell the buyer plainly that confirmation is taking longer than expected and not to resubmit payment |
| Not found | status endpoint 404s for the given ref | Same as "missing/invalid ref" |
