# Golden — door admission rules

## The defect being fixed

`app/api/admin/checkin/route.ts` today looks a ticket up by `bookingRef` alone and
refuses only a ticket that is ALREADY checked in. It never checks `status === 'paid'`
and never checks `showId`. A merely `reserved` ticket — created the instant a checkout
is *initiated*, before PayFast confirms anything — is as admissible at the door as a
paid one. Anyone who starts a checkout and abandons it walks away with a working door
code. It is also an unguarded read-then-write, so two scanners hitting the same code at
once can both succeed.

## Required decision table

Input: `bookingRef` (string, from the scanner). Every decision is made against the
ticket document as read **inside** the transaction, never against a prior read.

| # | Condition (evaluated in this order) | Outcome | HTTP | Firestore write |
|---|-------------------------------------|---------|------|-----------------|
| 1 | `bookingRef` missing or not a non-empty string | refuse, `code: 'bad-request'` | 400 | none |
| 2 | no ticket with that `bookingRef` | refuse, `code: 'not-found'` | 404 | none |
| 3 | `ticket.showId !== NATIONAL_SHOW_ID` | refuse, `code: 'wrong-show'` | 403 | none |
| 4 | `ticket.status === 'checked-in'` | refuse, `code: 'already-checked-in'` | 409 | none — the existing `checkedInAt` is NEVER overwritten |
| 5 | `ticket.status !== 'paid'` (i.e. `reserved`, or anything else) | refuse, `code: 'unpaid'` | 403 | none |
| 6 | otherwise (`paid`, right show) | admit | 200 | `status: 'checked-in'`, `checkedInAt: now` |

Rule 4 is deliberately ordered before rule 5 so an already-admitted ticket reports
"already checked in" rather than "unpaid" — a `checked-in` ticket is by definition no
longer `paid`, and the door staff message must reflect what actually happened.

Refusal reasons are returned as a stable machine `code` plus the existing
`{ success: false, error }` shape the scanner UI already renders. Do not invent new
visitor-facing copy beyond a short error string per code; no Sanity fields, no brand
assets.

## Required transaction

Rules 2–6 (the fresh read, the decision, and the write) must happen inside a single
`db.runTransaction()`. Two concurrent scans of the same paid ticket must admit exactly
once: the loser re-runs against committed state, sees `checked-in`, and refuses with
`already-checked-in`. No external network calls inside the transaction.

## Required module boundary

Because Firebase Auth is not provisioned on this project (see `README.md`), the
admission logic must be callable without an HTTP session so it can be proved against
real Firestore. Extract it:

- **New file `lib/checkin.ts`** — server-only. Exports:

  ```ts
  export type CheckinRefusalCode =
    | 'bad-request' | 'not-found' | 'wrong-show' | 'unpaid' | 'already-checked-in';

  export type CheckinResult =
    | { ok: true; ticket: Ticket }
    | { ok: false; code: CheckinRefusalCode; httpStatus: number; error: string };

  export async function checkInByBookingRef(bookingRef: unknown): Promise<CheckinResult>;
  ```

- **`app/api/admin/checkin/route.ts`** keeps its auth (session cookie + admin claim) and
  otherwise becomes a thin wrapper: parse body → `checkInByBookingRef` → map the result
  to a response. All admission logic lives in `lib/checkin.ts`; the route contains no
  status or showId comparison of its own.

Auth behaviour is unchanged and must stay: no session cookie → 401; a session cookie
that does not verify → 401; a verified non-admin → 403. Nothing is read from or written
to Firestore before auth passes.
