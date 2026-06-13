# D3 Golden — Firestore ticket model

**Feature:** D3
**Spec:** d3-ticket-model
**Contract:** `contracts/contract-d3-ticket-model.yaml`
**Scope:** Data model only — TypeScript types + Firestore schema doc. No purchase flow, no runtime code, no API routes.

---

## What D3 must produce

Two files change:

1. `types/index.ts` — gains three ticket-related exported types.
2. `docs/firestore-tickets.md` — new Firestore collection schema documentation.

Nothing else. No components, no API handlers, no Firestore writes.

---

## 1. TypeScript types (`types/index.ts`)

Appended to the existing file (which already holds Society, SocietyEvent, NationalShow, ShowWinner, Award, BoardMember, HeroImage, Partner, Province, ShowClass, SanityEvent, ContactSubmission). TypeScript strict mode — no `any`, no unexplained assertions.

### `TicketStatus`

A string-literal union covering the lifecycle of an issued ticket:

```ts
export type TicketStatus = 'reserved' | 'confirmed' | 'checked-in' | 'cancelled';
```

- `reserved` — held during checkout, not yet paid.
- `confirmed` — paid and issued; the normal post-purchase state.
- `checked-in` — scanned at the door on show day.
- `cancelled` — refunded or voided; seat released.

### `TicketType`

A purchasable ticket class (the "product"), not an individual ticket:

```ts
export interface TicketType {
  id: string;        // Firestore doc id
  name: string;      // "Adult" | "Child" | "SAOC Member" | …
  price: number;     // ZAR cents (integer — avoid float currency)
  available: number; // remaining inventory for this class
}
```

- `price` is **ZAR cents** (e.g. `15000` = R150.00). Integer to dodge floating-point money bugs.
- `available` is decremented as tickets are issued (decrement logic is a later feature, not D3).

### `Ticket`

An individual issued ticket:

```ts
export interface Ticket {
  id: string;            // Firestore doc id
  showId: string;        // references a nationalShows doc
  ticketTypeId: string;  // references a ticketTypes doc
  attendeeName: string;
  attendeeEmail: string;
  bookingRef: string;    // human-friendly reference, e.g. "SAOC-2026-A4F9"
  status: TicketStatus;
  purchasedAt: string;   // ISO 8601 timestamp
  checkedInAt?: string;  // ISO 8601 — set by the door scanner; absent until check-in
}
```

- `bookingRef` is the customer-facing reference shared across a booking and printed/emailed.
- `checkedInAt` is **optional** — only present once `status` becomes `checked-in`.
- Timestamps are stored as ISO strings on the TS type. (The Firestore doc may store native Timestamps; the schema doc records that mapping.)

---

## 2. Firestore schema doc (`docs/firestore-tickets.md`)

Must document at minimum:

- **Collection name:** `tickets` (top-level collection).
- **`ticketTypes` placement decision:** documented as a **separate top-level collection** `ticketTypes` (not a subcollection). Rationale: ticket classes are show-scoped reference data queried independently of issued tickets, and keeping them top-level keeps inventory reads cheap and avoids deep subcollection paths. The doc must state this choice explicitly.
- **Fields table** for `tickets`: every field name, its Firestore type, and a one-line description. Note where the TS `string` ISO timestamps map to Firestore `Timestamp`.
- **Fields table** for `ticketTypes`: `name`, `price` (number, ZAR cents), `available` (number), plus the `showId` linkage if classes are show-scoped.
- **Example document** for a `tickets` doc as JSON.
- **Indexes:** composite index on `showId` + `status` (door check-in and per-show queries), and a note on any single-field index needs. The literal token `showId` must appear.

### Example shape (illustrative)

```json
{
  "showId": "show_18_2026",
  "ticketTypeId": "tt_adult",
  "attendeeName": "Thandi Mokoena",
  "attendeeEmail": "thandi@example.co.za",
  "bookingRef": "SAOC-2026-A4F9",
  "status": "confirmed",
  "purchasedAt": "2026-06-01T09:30:00.000Z"
}
```

---

## Assertions → what proves them

| ID | Proven by |
|----|-----------|
| D3-01 | `export type TicketStatus` present in `types/index.ts` |
| D3-02 | `export interface TicketType` (or `type`) present |
| D3-03 | `export interface Ticket` (or `type`) present |
| D3-04 | `bookingRef` field on `Ticket` |
| D3-05 | `checkedInAt?:` optional field on `Ticket` |
| D3-06 | `'checked-in'` value in the `TicketStatus` union |
| D3-07 | `docs/firestore-tickets.md` file exists |
| D3-08 | doc references the `tickets` collection |
| D3-09 | doc references the `showId` index |
| D3-GATE-01 | `pnpm type-check` exits 0 |
| D3-GATE-02 | `pnpm lint` exits 0 |

---

## QA checklist (manual reference)

- [ ] All three types exported; no `any`.
- [ ] `price` documented as ZAR cents (integer).
- [ ] `checkedInAt` is optional (`?`), not required.
- [ ] `ticketTypes` placement decision stated with rationale.
- [ ] Composite `showId` + `status` index documented.
- [ ] Example JSON is valid and matches the `Ticket` shape.
- [ ] No purchase-flow / API / component code introduced — data model only.
- [ ] `pnpm type-check` and `pnpm lint` both clean.

---

## Out of scope (do NOT build in D3)

- Purchase / checkout flow.
- Payment integration.
- Inventory decrement logic.
- Door-scanner UI.
- Any API route or React component.
- Firestore security rules (separate feature).
