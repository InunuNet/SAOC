# Ticketing System — Developer Reference

## Overview

The ticketing system allows visitors to purchase tickets for the 2027 National Show through `/tickets`. The flow is end-to-end: price discovery from Sanity → buyer form → PayFast sandbox payment → confirmation landing. All visitor-facing copy is editable content in Sanity; the payment machinery is a verified security boundary that never imports Sanity.

**Critical**: Prices and capacities seeded in the dataset are **invented placeholders** pending council confirmation. Ticket sales default to CLOSED (`nationalShow.salesOpen = false`), and every seeded ticket type is explicitly marked "Provisional price — pending council confirmation."

### Security hardening

A dedicated hardening pass closed the door-scanner admission logic, the checkout
capacity race, checkout idempotency, booking-reference entropy, reservation expiry, and
several further defects found under adversarial QA. See
[docs/ticketing-hardening.md](ticketing-hardening.md) for the full account — several
claims elsewhere in this document (booking-ref format, the capacity TOCTOU gap, the
`SITE_URL` gap) predate that pass and are corrected inline below where they are now
stale. **The door scanner still cannot be exercised end to end in any environment
today** — Firebase Auth is not provisioned on `saoc-webapp`; see that document's
"Standing blocker" section.

## The Flow: End to End

```
1. Visitor lands on /tickets
   ↓
2. /tickets Server Component fetches:
   - ticketsPage (all copy, including buy button label)
   - nationalShow.salesOpen (gate check)
   - active ticketTypes (prices, capacities)
   ↓
3. Sold counts calculated from Firestore (reserved + paid tickets)
   ↓
4. Buy form renders with state:
   - IF salesOpen === false → SalesClosedNotice (disabled form)
   - ELSE IF allSoldOut → "Sold out" banner
   - ELSE → TicketPurchaseForm
   ↓
5. Buyer selects type, enters name + email, clicks buyButtonLabel
   ↓
6. TicketPurchaseForm POSTs /api/tickets/checkout
   - Server: validates input, fetches fresh Sanity price for type
   - Server: derives amount (never from request body)
   - Server: checks capacity (TOCTOU gap noted below)
   - Server: writes reserved ticket to Firestore
   - Returns signed PayFast field set + booking ref
   ↓
7. Browser auto-submits to PayFast sandbox (PAYFAST_SANDBOX_PROCESS_URL)
   ↓
8. PayFast payment page renders; buyer pays
   ↓
9. PayFast completes, redirects browser to return_url:
   /tickets/confirmation?ref=<bookingRef>
   ↓
10. /tickets/confirmation (Client Component) lands
    - Shows "Confirming your payment" (honest pending state)
    - Polls /api/tickets/status?ref=<bookingRef> every 3 seconds
    - Waits for payment confirmation from PayFast's ITN (max 20 attempts, ~1 min)
    ↓
11. Simultaneously, PayFast POSTs /api/tickets/itn (server-to-server)
    - Signature check, source-IP allowlist, amount match, PayFast server confirm
    - Atomic write, guarded positively on `status === 'reserved'` (not merely
      `!== 'paid'`) so a late/duplicate ITN can never resurrect a `checked-in` or
      `cancelled` ticket — see docs/ticketing-hardening.md's "ITN write guard" section
    ↓
12. /tickets/confirmation polling resolves to "confirmed" state
    - Shows "You're booked in"
    - Displays booking ref
    - Displays ticketIncludesNote
    ↓
13. (F5, not yet implemented) Resend emails ticket with QR code
    - QR encodes the booking ref
    - Email send is isolated from ITN — cannot break payment
    - Door scanner (app/admin/door) will read QR for check-in
```

### The ITN Race (F3 Correctness Trap)

The buyer's browser redirect (step 9) arrives instantly. The server-to-server ITN (step 11) may take a few seconds or fail entirely (transient network, PayFast queue). So `/tickets/confirmation` **always lands first**, before `purchasedAt` is ever written. The page handles this by:

1. **Never claiming success on arrival** — shows "Confirming your payment" instead
2. **Polling the read-only status endpoint** — does not trust Firestore directly (the app owns that data, the user should not)
3. **Graceful timeout** — after ~1 minute of polling, suggests contacting info@saoc.co.za with booking ref
4. **Honest states**: `checking` / `reserved` / `confirmed` / `not-found` / `timed-out`

The status endpoint returns **only `{ status }`** — no name, email, amount, or ids. Booking references are now 60-bit random values (see [Security hardening](#security-hardening) below), so the original "return only status" reasoning about a guessable ref is no longer why this matters — but the endpoint still returns status only, and per-IP rate limiting remains deferred.

### If the Buyer Cancels (F4)

Clicking PayFast's "Cancel" button redirects to `/tickets/cancelled?ref=<bookingRef>`. The route:

- Fetches the `ticketsPage` copy singleton (cancelledHeading, cancelledMessage, cancelledButtonLabel)
- Explains nothing was charged
- Offers a link back to `/tickets`
- **Makes no Firestore write** — the `reserved` ticket doc is left untouched for cleanup in F6/F7

## Content vs. Money Boundary

**The line is hard and mechanically enforced:**

| What | Where | Editable? |
|------|-------|-----------|
| **CONTENT: Everything a visitor reads** | `ticketsPage` Sanity singleton | Yes, Lee-Ann edits in Studio |
| Ticket type names, descriptions | `ticketType` Sanity docs | Yes |
| Sales message when closed | `ticketsPage.salesClosedMessage` | Yes |
| Confirmation copy (all 6 fields) | `ticketsPage` | Yes |
| Cancellation copy (all 3 fields) | `ticketsPage` | Yes |
| Terms/refund/door-entry note | `ticketsPage.termsNote` | Yes |
| **MONEY: The payment machinery** | | No |
| Amount derivation logic | `app/api/tickets/checkout/route.ts` | No |
| Capacity checking | `app/api/tickets/checkout/route.ts` | No |
| ITN verification & payment write | `app/api/tickets/itn/route.ts` | No, SHA-256 pinned |
| PayFast signature generation | `lib/payfast.ts` | No |
| **GATE: Functional switches** | | |
| Sales open/closed | `nationalShow.salesOpen` boolean | Yes, Lee-Ann toggles in Studio |

**Mechanical enforcement:**

- `lib/payfast.ts` (signature generation) — **forbidden from importing Sanity** (A51)
- `app/api/tickets/itn/route.ts` (payment receipt) — **forbidden from importing Sanity** (A52), and **byte-identical to contract authoring** (A53)
- The checkout route derives amount **always** from Sanity, **never** from the request body (A21)
- The checkout route rejects POST when `salesOpen !== true`, not just hiding the UI (A22)

Violation of any of these would be a payment security issue — fixed at commit time, not runtime.

## Sanity Schema: ticketType

```typescript
interface TicketType {
  _id: string;      // "ticketType-<slug>"
  _type: "ticketType";
  name: string;     // "Adult", "Pensioner", "Child", "SAOC Member", "Exhibitor"
  slug: string;     // "adult", "pensioner", "child", "saoc-member", "exhibitor"
  price: number;    // ZAR
  description: string;  // "Provisional price — pending council confirmation." (seeded)
  capacity: number; // Total available for this type
  active: boolean;  // Only active=true types are shown on /tickets
  order: number;    // Display order (1–5)
}
```

### Creating / Editing Ticket Types

1. Open Sanity Studio (`/studio`)
2. Click "Ticket Type" in the sidebar
3. Create a new document or edit an existing one
4. Set all seven fields above
5. Publish the document
6. **For pricing changes**, simply update the `price` field — the checkout route fetches it fresh on every request (no cache, no restart needed)
7. **To hide a type without deleting it**, set `active: false`

The `/tickets` page revalidates every 60 seconds (ISR CDN cache), so changes appear within a minute.

## Sanity Schema: ticketsPage (Copy Singleton)

The `ticketsPage` document (pinned `_id: "ticketsPage"`) holds every visitor-facing string across all three ticketing pages. See `sanity/schemas/documents/ticketsPage.ts` for the full 15-field schema.

### Buy Page Fields

| Field | Where shown | Type |
|-------|-------------|------|
| `title` | H1 on /tickets | string |
| `intro` | Lede below H1 | text (multiline) |
| `buyButtonLabel` | Submit button in form | string |
| `soldOutMessage` | "Sold out" badge per type + all-sold-out banner | string |
| `salesClosedMessage` | Large notice when sales are closed | text |
| `termsNote` | Footer of /tickets | text |

### Confirmation Page Fields

| Field | Where shown | Type |
|-------|-------------|------|
| `confirmationPendingHeading` | H1 while polling | string |
| `confirmationPendingMessage` | Message while waiting for ITN | text |
| `confirmationSuccessHeading` | H1 when paid | string |
| `confirmationSuccessMessage` | Success message | text |
| `confirmationNotFoundMessage` | "Booking not found" message | text |
| `ticketIncludesNote` | Footer on success state | text |

### Cancellation Page Fields

| Field | Where shown | Type |
|-------|-------------|------|
| `cancelledHeading` | H1 | string |
| `cancelledMessage` | Explanation of what happened | text |
| `cancelledButtonLabel` | "Back to tickets" link text | string |

**Editing the singleton:**

1. Open Sanity Studio
2. Click "Tickets Page" in the sidebar (under "Singletons")
3. Edit any field; all are optional (have hardcoded fallbacks)
4. Publish
5. Changes appear on the live site within a minute (ISR cache)

## Server-Side Authority

### Price Derivation

Every checkout request triggers a fresh Sanity fetch of the `ticketType` document:

```typescript
// app/api/tickets/checkout/route.ts, line 115–128
const ticketTypeDoc = await client.fetch<SanityTicketType | null>(
  ticketTypeBySlugQuery,
  { slug: ticketType }
);
if (!ticketTypeDoc) {
  return NextResponse.json({ error: `Unknown ticketType: ${ticketType}` }, { status: 400 });
}
const amount = ticketTypeDoc.price;
```

The client never supplies or influences `amount`. A request body field is ignored. This is a **payment security boundary** — if violated, a buyer could craft a POST claiming price = 0 and receive a signed PayFast payload for free.

### Capacity Checking

The count, an idempotency-key replay check, and the reservation write all happen
**inside one Firestore transaction** (`reserveTicket` in
`app/api/tickets/checkout/route.ts`):

```typescript
const alreadyHeld = soldCounts[input.ticketType] ?? 0;
if (alreadyHeld + REQUESTED_QUANTITY > input.capacity) return { kind: 'over-capacity' };
```

This was previously a read-then-write with no transaction (a TOCTOU race) and was
demonstrated to oversell — 5 concurrent checkouts for the last seat all returned 201.
It is now transactional; see docs/ticketing-hardening.md (F2) for the fix and its
verification, which pushed to 20-way concurrency with no oversell. A `reserved`
ticket also stops counting toward capacity once its `expiresAt` passes (F5 in that same
document — reservations are no longer held forever by an abandoned checkout).

### Sales-Open Gate

Before any of the above, the route checks the `nationalShow.salesOpen` boolean:

```typescript
// lines 99–111
if (salesOpen?.salesOpen !== true) {
  return NextResponse.json({ error: 'Ticket sales are currently closed.' }, { status: 403 });
}
```

This is a **functional gate, not just UI**. Posting directly to `/api/tickets/checkout` when sales are closed returns 403, even if `/tickets` is hidden.

## Data Models

### Firestore `tickets` Collection

Each purchase attempt creates (or reserves) a document:

```typescript
interface Ticket {
  bookingRef: string;       // "SAOC-2027-" + 12-char Crockford base32 (60-bit random)
  showId: string;           // Always "nationalShow" for now
  attendeeName: string;     // Buyer's entered name
  attendeeEmail: string;    // Buyer's entered email (lowercase)
  ticketType: string;       // Slug: "adult", "pensioner", etc.
  status: "reserved" | "paid" | "cancelled" | "checked-in";
  amount: number;           // ZAR (derived from Sanity)
  expiresAt: Timestamp | null;    // Reservation TTL (lib/tickets-constants.ts); a
                                   // `reserved` doc past this no longer counts toward
                                   // capacity. Never checked once status is 'paid'.
  idempotencyKey: string;   // From the Idempotency-Key header; bound to attendeeEmail
                             // + ticketType, not matched on the key alone
  purchasedAt: Timestamp | null;  // Set by ITN webhook
  checkedInAt: Timestamp | null;  // Set by door scanner
  m_payment_id: string;     // Matches bookingRef (for PayFast signature)
  pf_payment_id: string | null;   // PayFast's internal ID (set by ITN)
}
```

**Statuses:**

- `reserved` — created by checkout, not yet paid (ITN pending). Releases its seat
  automatically once `expiresAt` passes (see docs/ticketing-hardening.md, F5) — no
  status write happens, it simply stops being counted.
- `paid` — ITN webhook confirmed; purchasedAt is set. A `paid` ticket's seat is held
  forever regardless of `expiresAt`.
- `cancelled` — buyer clicked PayFast cancel (reserved doc left untouched; this status
  is not currently written by any route)
- `checked-in` — door scanner scanned the QR code. The ITN write guard cannot move a
  `checked-in` ticket back to `paid` (docs/ticketing-hardening.md, F8).

### Sanity `nationalShow` Additions

```typescript
interface NationalShow {
  // ... existing fields (title, hero, exhibitorStages, etc.)
  salesOpen?: boolean;  // Default false; when true, checkout accepts POSTs
}
```

## Seeding: scripts/seed-ticketing.ts

The `scripts/seed-ticketing.ts` script is **additive and non-destructive**, unlike `scripts/seed-page-singletons.ts` (which force-replaces content and is known-hazardous).

### Run the Script

```bash
node --import tsx/esm scripts/seed-ticketing.ts
```

Requires `.env.local` to have:
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_TOKEN` (write-enabled Editor token)

### What It Does

1. **Creates the five council ticket types** (if they don't exist):
   - Adult (price 150 ZAR, capacity 300)
   - Pensioner (100 ZAR, capacity 100)
   - Child (50 ZAR, capacity 100)
   - SAOC Member (100 ZAR, capacity 150)
   - Exhibitor (0 ZAR, capacity 50)

   Uses `client.createIfNotExists(...)` with deterministic `_id: ticketType-<slug>` — a second run never overwrites an existing type or an editor's changes.

2. **Creates the ticketsPage singleton** (if it doesn't exist):
   - All 15 fields seeded with complete, real wording
   - Never blank (empty Sanity fields signal a broken CMS to editors)
   - Uses `createIfNotExists`

3. **Patches `nationalShow` with `salesOpen: false`** (if the field is absent):
   - Uses `client.patch(...).setIfMissing({ salesOpen: false })`
   - Never overwrites if an editor has already set the field
   - Allows deliberate "open sales for demo" to survive a re-run

### Why This Pattern Matters

`scripts/seed-page-singletons.ts` is a known hazard: it uses `createOrReplace` with hardcoded literals. Re-running it silently reverts any editor changes made in Studio since the last seed run. This is a blocker on mission `saoc-pages-editable`.

`seed-ticketing.ts` avoids this by:
- Using `createIfNotExists` for document creation (idempotent)
- Using `setIfMissing` for `salesOpen` patch (preserves editor state)
- Never overwriting, only adding or patching absent fields

Safe to re-run as many times as needed. Safe to run after an editor has customized prices or copy.

### Placeholder Prices & Capacities

Every seeded ticket type carries the description: *"Provisional price — pending council confirmation."* This is **explicit on every document** — the provisional marking is not centralised, so it's impossible to miss. When the council confirms real prices, simply edit the `price` fields in Studio; the seed script doesn't need to re-run.

Capacities are likewise invented (300, 100, 100, 150, 50) and should be confirmed with the council before going live.

## Component Tree

```
app/(marketing)/tickets/
├── page.tsx              # Server Component — fetches Sanity, renders
├── loading.tsx           # Route-level loading skeleton
├── confirmation/page.tsx # Client Component — polls status endpoint
└── cancelled/page.tsx    # Server Component — cancellation landing

components/tickets/
├── TicketPurchaseForm.tsx      # Client Component — form with validation
├── TicketTypeCard.tsx          # Card for each type (price, sold-out badge)
├── TicketFormField.tsx         # Input wrapper with error display
├── PayfastRedirectForm.tsx     # Hidden form that auto-submits to PayFast
└── SalesClosedNotice.tsx       # Notice shown when sales are closed
```

Each component stays under 150 lines (project limit) and uses only the Sage & Paper design system (no new tokens, no invented colours).

## Known Gaps

The gaps formerly tracked here — the capacity TOCTOU race, missing duplicate-POST
idempotency, the guessable 6-digit booking reference, the missing `SITE_URL`, and
unreleased abandoned reservations — were all closed by the security hardening pass;
see [docs/ticketing-hardening.md](ticketing-hardening.md) for what changed and how each
is verified. What remains open:

### Emailed QR Ticket Not Yet Built (F5, ticketing-pages mission)

The door scanner (`app/admin/door`) is wired and waiting, but see the standing blocker
below. It reads QR codes containing the booking reference. Emailing a ticket with a
scannable QR code to `attendeeEmail` on confirmed payment is not yet built.

### Standing blocker: Firebase Auth not provisioned

Firebase Authentication has never been enabled on the `saoc-webapp` project, so no
admin session cookie can be minted by anything. `/admin/login` and the door scanner
(`POST /api/admin/checkin`) are non-functional in every environment today —
independent of the ticketing security fixes, which cover the admission *logic*
(`lib/checkin.ts`) but not the authenticated *path* to it. See
docs/ticketing-hardening.md's "Standing blocker" section and
`.agent/memory/project/needs-human.md`.

### Reservation expiry is 30 minutes, no active release on cancel

An abandoned checkout now releases its seat automatically after
`RESERVATION_TTL_MINUTES` (30 minutes, `lib/tickets-constants.ts`) — see F5 in
docs/ticketing-hardening.md. Clicking PayFast's cancel button still does **not**
actively write anything (deliberately — an unauthenticated write keyed on a printed
booking reference is a worse problem than a 30-minute hold); the seat is released only
once the lazy TTL passes.

## Environment & Deployment

### Development

```bash
cp .env.local.example .env.local
# Fill in Firebase + Sanity credentials
node --import tsx/esm scripts/seed-ticketing.ts  # Seed once
pnpm dev
```

Visit [http://localhost:3000/tickets](http://localhost:3000/tickets).

### Deployment

`apphosting.yaml` now declares `SITE_URL` (`RUNTIME` availability only, not a secret —
see docs/ticketing-hardening.md F4) alongside the `PAYFAST_SANDBOX_*` secret
references. The checkout route reads `SITE_URL` at request time (not build time) so the
fallback (`DEFAULT_SITE_URL = 'https://saoc.co.za'`, which still resolves to the old
Joomla site) is never baked into the bundle and never used once `SITE_URL` is set.
Nothing here is deployed today — there is no production domain and PayFast is sandbox
only.

## Testing Checklist (Before Going Live)

- [ ] `pnpm build` passes (no TypeScript errors, no lint)
- [ ] `pnpm type-check` passes
- [ ] `/tickets` renders with sales-closed notice (default state)
- [ ] Edit `nationalShow.salesOpen = true` in Studio
- [ ] `/tickets` renders buy form with all ticket types visible
- [ ] Prices match Sanity (not hardcoded)
- [ ] Change a price in Studio; reload /tickets; new price appears
- [ ] Complete a checkout → PayFast sandbox payment page loads
- [ ] Complete payment → redirected to /tickets/confirmation
- [ ] Confirmation page polls and resolves to "You're booked in"
- [ ] Click "Back to tickets" link
- [ ] Click PayFast cancel button on a fresh checkout → /tickets/cancelled
- [ ] Verify Firestore: `reserved` ticket exists with booking ref
- [ ] Verify Firestore: after ITN, ticket status is `paid`, purchasedAt is set
- [ ] Zoom/mobile at 320px: all elements readable, buttons tappable
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Try bypassing sales-closed UI by POSTing /api/tickets/checkout directly → 403
- [ ] Try tampering with amount in POST body → signature mismatch, 400
- [ ] Try POST with invalid email → 400
- [ ] Try POST with missing showId → 400
- [ ] Verify no console errors or warnings

## Go-Live Checklist (F7, Requires SAOC Action)

- [ ] SAOC registers its own PayFast merchant account (non-profit rate)
- [ ] Credentials (merchant ID, key, passphrase) are provided to the team
- [ ] Credentials added to production Secret Manager in Firebase
- [ ] `apphosting.yaml` updated with SITE_URL and secret references
- [ ] Production PayFast account tested end-to-end (real payment test)
- [ ] `nationalShow.salesOpen` set to true in production Studio
- [ ] Real ticket prices confirmed by council and entered into Sanity
- [ ] Real capacity limits confirmed and entered into Sanity
- [ ] Email copy confirmed (subject, body) and seeded to `ticketsPage`
- [ ] Ticket refund/transfer policy confirmed and published
- [ ] Terms & conditions link added to `/tickets`
- [ ] Press release / announcement drafted
- [ ] Marketing email drafted (to past attendees, societies)

## Queries & APIs

### Sanity Queries

- `activeTicketTypesQuery` — fetches all active ticket types (used by `/tickets`)
- `ticketTypeBySlugQuery` — fetches a single type by slug (used by checkout route)
- `nationalShowSalesQuery` — fetches `salesOpen` boolean (used by checkout route)
- `ticketsPageQuery` — fetches all 15 copy fields (used by all three ticketing pages)

All defined in `sanity/queries.ts`.

### Firestore Queries

- `getSoldCountsByTicketType()` (`lib/data/tickets.ts`) — the single counting path for
  both `/tickets` sold-out badges and the checkout route's capacity check. Queries
  `where('showId', '==', showId)` for both `status == 'reserved'` and `status == 'paid'`,
  then filters out any `reserved` document whose `expiresAt` has passed. Accepts an
  optional Firestore `Transaction` so the checkout route's read is part of its
  reservation transaction.
- `db.collection('tickets').where('bookingRef', '==', ref)` — look up a single ticket by ref (used by status endpoint and `lib/checkin.ts`)

### REST Endpoints

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/api/tickets/checkout` | Start checkout, create reserved ticket | None |
| GET | `/api/tickets/status?ref=<ref>` | Poll ticket status (read-only) | None |
| POST | `/api/tickets/itn` | PayFast webhook (server-to-server) | Signature + IP allowlist |

## References

- **Sanity schemas**: `sanity/schemas/documents/ticketType.ts`, `sanity/schemas/documents/ticketsPage.ts`
- **Seed script**: `scripts/seed-ticketing.ts`
- **Pages**: `app/(marketing)/tickets/{page,loading}.tsx`, `tickets/confirmation/page.tsx`, `tickets/cancelled/page.tsx`
- **Routes**: `app/api/tickets/{checkout,status,itn}/route.ts`
- **Components**: `components/tickets/`
- **Constants**: `lib/tickets-constants.ts`
- **Helpers**: `lib/data/tickets.ts`
- **Payment lib**: `lib/payfast.ts` (never import Sanity)

## FAQ

**Q: Can I change the booking reference format?**

A: Yes, but carefully. Generation now lives in `lib/booking-ref.ts`
(`generateBookingRef()`), drawing from `node:crypto` `randomBytes` into a 12-character
Crockford base32 segment (60 bits of entropy) — not the checkout route, and not a
6-digit counter. See docs/ticketing-hardening.md (F3) for why the format changed.
Changing it affects:
- QR codes generated in F5 emails
- Door scanner lookups (must scan the same ref)
- User-facing confirmation copy (booking ref is shown)

Test the change end-to-end before deploying.

**Q: What if PayFast's ITN never arrives?**

A: The buyer lands on `/tickets/confirmation` and sees "Confirming your payment" (honest pending state). They poll for 1 minute, then see "This is taking longer than expected — contact info@saoc.co.za with your booking reference."

The `reserved` ticket stays in Firestore untouched. The buyer can contact support with the booking reference; the team can manually look up the Firestore doc and verify whether PayFast's server eventually confirms the payment (check transaction logs).

**Q: Can I edit `app/api/tickets/itn/route.ts`?**

A: No. It is a verified security boundary (SHA-256 pinned, contract assertion A15 in
`contracts/contract-ticketing-hardening.yaml`). Any change — even a comment, even a
benign refactor — breaks that assertion. The file *has* been deliberately re-pinned
once, to fix a genuine defect found inside it (docs/ticketing-hardening.md, "ITN write
guard, and the A15 re-pin ceremony") — the re-pin was computed by `@architect` from an
architect-authored expected file before any code was written, never by `@dev`. If you
need to modify the ITN handler, file a bug with the full reasoning; the change will
require the same ceremony and adversarial security review before it lands.

**Q: Can I add more ticket type fields?**

A: Yes. The schema is extensible. Just remember:
- The checkout route only uses `name`, `price`, `capacity` (see `SanityTicketType` interface in the route)
- If you add a field, update the Sanity query to fetch it
- All new fields are optional; keep seeding additive (`createIfNotExists`)

**Q: What happens if a ticket type is set to `active: false`?**

A: It is immediately hidden from `/tickets` (the query filters `active == true`). Existing `reserved` or `paid` tickets with that type remain valid and scannable at the door. Buyers cannot purchase the type anymore, but it stays in Firestore history.

**Q: How do I test the PayFast integration locally?**

A: PayFast sandbox is configured with Brad's account credentials in `.env.local`. The checkout route uses `PAYFAST_SANDBOX_PROCESS_URL`, which routes to the real sandbox (not a mock). Completing a test payment triggers the real sandbox ITN to your local `localhost:3000/api/tickets/itn` — use a tool like `ngrok` to expose your local port if testing ITN.

**Q: Can I run seed-ticketing.ts multiple times?**

A: Yes. `createIfNotExists` and `setIfMissing` make it safe. Editor changes to ticket prices, copy, or the `salesOpen` flag are never overwritten by a re-run.
