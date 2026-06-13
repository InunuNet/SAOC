# D3 Ticket Model — Golden Reference

What a passing D3 implementation looks like. Scope: **types and schema doc only**.
No buy flow, no Stripe SDK, no API routes, no Firestore writes.

## 1. `types/index.ts` additions

A passing implementation adds (and does not remove or alter) the following to the
existing `types/index.ts`. It imports the Firestore `Timestamp` type (type-only
import is preferred so nothing extra ships to the client).

```ts
import type { Timestamp } from 'firebase-admin/firestore';

export type TicketStatus = 'reserved' | 'paid' | 'cancelled' | 'checked-in';

export type TicketType = 'general' | 'member' | 'vip';

export interface Ticket {
  id: string;
  bookingRef: string;
  showId: string;
  attendeeName: string;
  attendeeEmail: string;
  ticketType: TicketType;
  status: TicketStatus;
  purchasedAt: Timestamp | null;
  checkedInAt: Timestamp | null;
  stripePaymentIntentId: string | null;
}
```

### Acceptable variations
- `Ticket` may be declared with `export type Ticket = { ... }` instead of `export interface`.
  Both satisfy `export (type|interface) Ticket`.
- `Timestamp` may be imported from `firebase/firestore` (client) or `firebase-admin/firestore`
  (admin) — either resolves the type. Admin is the more natural fit since tickets are
  server-written, but the contract only requires the identifier to be present and type-check
  to pass.
- Field order inside `Ticket` may differ, but every field above must be present with the
  exact name and type shown (the contract greps each `name: type` pair).

### Must NOT do
- Do not change `purchasedAt` / `checkedInAt` to non-nullable — they are `Timestamp | null`
  (reserved tickets have no purchase time yet; un-checked tickets have no check-in time).
- Do not change `stripePaymentIntentId` to non-nullable — it is `string | null`
  (null until a Stripe PaymentIntent exists; Stripe itself is out of scope for D3).
- Do not introduce `any`, untyped objects, or `string` in place of the `TicketType` /
  `TicketStatus` unions on the `ticketType` / `status` fields.
- Do not duplicate or modify pre-existing types (Society, NationalShow, ContactSubmission, etc.).

## 2. `docs/firestore-ticket-schema.md`

A markdown file documenting the `tickets` Firestore collection. It must:
- Name the collection explicitly as `tickets`.
- List every field of the `Ticket` interface with its type and a one-line purpose:
  `id`, `bookingRef`, `showId`, `attendeeName`, `attendeeEmail`, `ticketType`,
  `status`, `purchasedAt`, `checkedInAt`, `stripePaymentIntentId`.
- Explain the meaning of each `TicketStatus` value (reserved → paid → checked-in, or cancelled)
  and each `TicketType` tier (general, member, vip).
- Note that `purchasedAt`, `checkedInAt`, and `stripePaymentIntentId` are nullable and why.

A table form is ideal, e.g.:

| Field | Type | Nullable | Purpose |
|-------|------|----------|---------|
| `id` | string | no | Firestore document ID |
| `bookingRef` | string | no | Human-facing booking reference shown on the ticket |
| `showId` | string | no | References the `nationalShows` document this ticket admits to |
| `attendeeName` | string | no | Name printed on the ticket |
| `attendeeEmail` | string | no | Confirmation + check-in contact |
| `ticketType` | `'general' \| 'member' \| 'vip'` | no | Pricing / access tier |
| `status` | `'reserved' \| 'paid' \| 'cancelled' \| 'checked-in'` | no | Lifecycle state |
| `purchasedAt` | Timestamp | yes | Set when payment completes; null while reserved |
| `checkedInAt` | Timestamp | yes | Set at door scan; null until checked in |
| `stripePaymentIntentId` | string | yes | Stripe PaymentIntent id; null until payment initiated |

## 3. Gates

- `pnpm type-check` exits 0 (strict TS, the new types compile, `Timestamp` resolves).
- `pnpm lint` exits 0 (eslint clean — no unused imports; if `Timestamp` is imported it must
  be referenced, which it is, in three field types).

## Verification summary
All 19 content assertions (D3-01..D3-19) plus the two gates (D3-GATE-01/02) in phase 1
of `contracts/contract-d3-ticket-model.yaml` pass. The implementation touches exactly
two files: `types/index.ts` (additive) and `docs/firestore-ticket-schema.md` (new).
