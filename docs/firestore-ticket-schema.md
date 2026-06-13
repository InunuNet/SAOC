# Firestore — `tickets` Collection Schema

## Overview

The `tickets` collection stores individual ticket records for national show attendees. Each document represents one ticket purchased or reserved for a show.

## Document Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bookingRef` | `string` | Yes | Human-readable booking reference (e.g. `SAOC-2026-00042`). Unique per booking. |
| `showId` | `string` | Yes | References the `nationalShows` document ID for the show this ticket belongs to. |
| `attendeeName` | `string` | Yes | Full name of the ticket holder. |
| `attendeeEmail` | `string` | Yes | Email address of the ticket holder. Used for confirmation and check-in lookup. |
| `ticketType` | `'general' \| 'member' \| 'vip'` | Yes | Ticket tier. `member` requires a valid SAOC membership. |
| `status` | `'reserved' \| 'paid' \| 'cancelled' \| 'checked-in'` | Yes | Lifecycle state of the ticket. |
| `purchasedAt` | `Timestamp \| null` | Yes | Firestore Timestamp recording when payment was confirmed. `null` while still in `reserved` state. |
| `checkedInAt` | `Timestamp \| null` | Yes | Firestore Timestamp set when the attendee checks in at the door. `null` until check-in occurs. |
| `stripePaymentIntentId` | `string \| null` | Yes | Stripe PaymentIntent ID linked to the purchase. `null` for complimentary or manually issued tickets. |

## Status Lifecycle

```
reserved → paid → checked-in
         ↘ cancelled
```

- `reserved` — ticket is held but payment not yet confirmed
- `paid` — payment confirmed via Stripe; ticket is valid
- `cancelled` — ticket was voided before or after payment
- `checked-in` — attendee has arrived and been admitted at the show

## Indexes

Recommended composite indexes for common queries:

- `showId` ASC + `status` ASC — list all paid tickets for a show
- `attendeeEmail` ASC + `showId` ASC — look up a person's ticket for a specific show
- `bookingRef` ASC — unique lookup by booking reference

## Security Rules (reference)

Tickets should only be readable by:
- The authenticated attendee matching `attendeeEmail`
- Admin users with the `admin` custom claim

Write access is restricted to server-side API routes using the Firebase Admin SDK.

## TypeScript Type

Defined in `types/index.ts`:

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
