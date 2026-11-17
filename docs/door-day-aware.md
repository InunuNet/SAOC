# Day-Aware Door Admission

**Spec:** `contracts/golden/door-day-aware/README.md` (executable truth table:
`contracts/golden/door-day-aware/truth-table.json`).
**Contract:** `contracts/door-day-aware.yaml`.
**Check:** `contracts/checks/door-day-aware/admission.test.mjs`.

This document describes the check-in change in `lib/checkin.ts` and the door scanner. It
assumes familiarity with the admin check-in flow.

## The problem this solves

Before this change, a Weekend Pass was treated as a lifetime single-use ticket. Someone
admitted on day one was refused on days two and three, despite holding a multi-day pass.
Conversely, a day ticket could be admitted on any show day; its selected day was not enforced
at the door.

## The admission policy

The active show's dates define the allowed calendar days in South African Standard Time
(SAST, UTC+2). A scan on a date outside those days is refused with `not_show_day`. Show-day
membership is calendar based; opening hours do not further restrict admission.

For products requiring day selection, the stored `chosenDay` must be a valid Gregorian date
and match today. A mismatch is refused with `wrong_day`, whose message gives the ticket's valid
date. Missing or invalid selection gets a ticket-desk message. Required-day products include
`day-visitor`, `early-bird`, and catalogue products whose `requiresDaySelection` is exactly
`true`.

The two Weekend Pass ticket types (`weekend-pass` and `weekend-pass-early-bird`) can be
admitted once on each show day. The ticket's `checkIns` map records admission timestamps by
SAST date. A same-day repeat is refused. VIP and all other ticket types remain single-use.
Whether VIP should receive a multi-day entitlement is still an owner decision; this change
does not grant one.

The existing test-ticket guard runs before the day policy. After ticket lookup and show
ownership checks, a ticket rejected by the PR #69 guard is refused before any show-day or
chosen-day decision.

## Status and scanner count

`checkedInAt` remains the timestamp of a ticket's first admission and is preserved on later
Weekend Pass scans. `status` remains `checked-in` after the first admission; it is not reset
each day. The per-day `checkIns` map carries the additional Weekend Pass history. Successful
responses include `firstAdmission`: the scanner increments its unique-ticket counter only
when this value is true. Later admissions for the same Weekend Pass do not increase that
counter. Admin counts and CSV remain counts/rows of unique checked-in tickets, not daily scans.

## Files touched

- `lib/checkin-day-policy.ts` (new): pure SAST day, chosen-day, duplicate and payment policy.
- `lib/checkin-context.ts` (new): active show window and Sanity day-selection catalogue.
- `lib/checkin.ts`: ordered policy invocation and transactional per-day pass history.
- `lib/checkin-audit.ts`: audit outcomes for the day refusals.
- `app/api/admin/checkin/route.ts`: refusal response codes and audit outcome mapping.
- `types/index.ts`: optional ticket `checkIns` map.
- `components/admin/DoorResultBanner.tsx`: renders the new refusal responses.
- `components/admin/DoorScannerClient.tsx`: counts only first admissions.

## Known limits

- If the Sanity catalogue fetch fails on a show day, check-in returns an infrastructure error
  for every scan. This fails closed and does not widen access; door staff need a fallback plan.
- Each scan makes one uncached Sanity request.
- Sanity's CDN can take minutes to deliver a `requiresDaySelection` edit to the door.

## Running the tests

The contract is `contracts/door-day-aware.yaml`. Run the complete offline day-aware checks
from the repository root:

```bash
node --test contracts/checks/door-day-aware/*.test.mjs
```
