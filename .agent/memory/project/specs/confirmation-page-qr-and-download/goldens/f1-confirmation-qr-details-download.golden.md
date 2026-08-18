# Golden: F1 — QR + buyer details + download on the paid confirmation page

## The problem

`app/(marketing)/tickets/confirmation/page.tsx` (154 lines today) is a `'use client'` page that
polls `/api/tickets/status?ref=...` for `{ status }` and, once `status` is `paid`/`checked-in`,
renders only a heading and the booking ref as plain text. `lib/qr.ts:generateBookingRefQrDataUri()`
already exists and is already used in `emails/OrderConfirmation.tsx`, but the page renders no
image at all. This makes the confirmation EMAIL the only scannable artifact, putting email
deliverability on the critical path for door check-in (see backlog "P1 — QR exists only in the
confirmation email; page has none", and its superseding entry "P1 — Ticket delivery: QR on the
paid page + buyer details + download + email from info@saoc.co.za", Brad's instruction
2026-08-18).

**Scope for this feature (F1):** items 1-3 of Brad's instruction — QR on the page, buyer details
on the page, a download option. Item 4 (send FROM info@saoc.co.za) is explicitly OUT — Brad's
2026-08-18 decision is to stay on Option A (`tickets@tickets.saoc.co.za` FROM, `reply_to:
info@saoc.co.za`, tracked separately under `reply-to-header-fix`). Do not touch `lib/email.ts`'s
`TICKETS_FROM_ADDRESS` or any Resend domain configuration as part of this feature.

## The hard security constraint (non-negotiable — read this before touching anything)

`app/api/tickets/status/route.ts` is deliberately minimal — it returns `{ status }` and nothing
else. Its own header comment explains why: booking refs are 60-bit and effectively unguessable,
but anyone who *holds* a ref (a photographed ticket, a forwarded email) can already query this
endpoint, unauthenticated, with no rate limiting beyond what's deferred to a future feature.
Returning `attendeeName`/`ticketType`/`amount` from that endpoint would turn a photographed
ticket into a PII disclosure to anyone who can read the photo.

**Do not widen `/api/tickets/status`. Ever, for this feature.** The confirmation page is a Next.js
Server Component (RSC) — it can read Firestore directly via the Admin SDK on the server and embed
the result straight into the HTML it sends the browser. That HTML response is not a reusable JSON
API; there is no new endpoint an attacker can point at a stolen ref to get a machine-readable PII
blob back. This is the entire reason the fix is "make the page a Server Component," not "add a
`?details=true` query param to the status route." A7's `next build` regression guard and A4's grep
both exist specifically so a later implementer cannot "simplify" this back into the endpoint.

## Design: split the page into a Server Component + a thin client poller

The existing page has two jobs tangled together: (1) polling for the paid/reserved transition
(needed because the buyer's browser redirect races PayFast's server-to-server ITN — see
`contracts/golden/ticketing-m1-m2/page-states.golden.md`), and (2) rendering the confirmed state.
Split them:

1. **`app/(marketing)/tickets/confirmation/page.tsx` becomes an `async` Server Component.** It
   reads the `ref` search param (Next 16's `searchParams` prop, itself a `Promise` in the App
   Router — resolve it with `await`). If `ref` is present, it calls the new
   `getConfirmedTicketForDisplay(ref)` (below) **on the server**, in the same request that renders
   the page.
   - If it returns a confirmed ticket, render the QR image, buyer details, and the download
     control directly in the Server Component's output — real HTML, computed server-side, never
     round-tripped through client-side JSON.
   - If it returns `null` (not paid yet, or ref does not exist), render a small **client**
     component — e.g. `components/tickets/ConfirmationPoller.tsx` (`'use client'`) — that
     reproduces today's polling behavior against the UNCHANGED `/api/tickets/status` endpoint
     (still `{ status }` only; no behavior change to that route or its contract).
   - The Sanity `ticketsPageQuery` copy-fetch (pending/success/not-found heading and message
     strings) can stay client-side inside the poller, exactly as it works today, or move
     server-side — implementer's choice, not load-bearing for this feature.

2. **When the poller detects `paid`/`checked-in`, it calls `router.refresh()`** (from
   `next/navigation`) instead of trying to render the confirmed state itself. `router.refresh()`
   re-runs the Server Component for the current route with the same URL/searchParams, so the page
   re-executes step 1 above — this time `getConfirmedTicketForDisplay` finds the now-paid ticket
   and the confirmed branch renders, server-side, with real data. The poller's `useEffect`
   polling loop, `MAX_POLL_ATTEMPTS`/`POLL_INTERVAL_MS` timeout logic, and the `timed-out`/
   `not-found` UI states carry over unchanged from the current implementation — only the
   `confirmed` branch's rendering responsibility moves to the server.

   This is a standard Next.js App Router pattern (client component triggers a server re-render
   via `router.refresh()`) and is the reason no new API surface is needed anywhere in this
   feature: the ONLY network round trip that ever carries ticket state to the browser as JSON is
   the existing, unchanged `{ status }` poll.

## `lib/orders.ts`: the new server-only accessor

Add one function, alongside the existing order/position primitives already in that file:

```ts
export interface ConfirmedTicketDisplay {
  bookingRef: string;
  attendeeName: string;
  ticketType: TicketType;
  amount: number;
  qrDataUri: string;
}

export async function getConfirmedTicketForDisplay(
  bookingRef: string
): Promise<ConfirmedTicketDisplay | null>
```

- Looks up `tickets/{bookingRef}` the same way `lib/checkin.ts` and the status route already do
  (the position document's id IS the booking ref — direct `.doc(bookingRef).get()`, no query
  needed, cheaper than the status route's `.where('bookingRef', '==', ref)`).
- Returns `null` — not an error, not a partial object — unless the document exists AND its
  `status` is `'paid'` or `'checked-in'` (mirror the page's existing `CONFIRMED_STATUSES` set).
  This is the fail-closed behavior A5/A6 assert: a `reserved` position, same as an absent one,
  yields `null`, and the page falls back to the poller exactly as it does today for "not yet
  paid."
- Generates the QR itself, by calling the EXISTING `generateBookingRefQrDataUri(bookingRef)` from
  `lib/qr.ts` — do not duplicate that logic, do not add a second QR code path.
- Reads `attendeeName`, `ticketType`, `amount`, `bookingRef` straight off the position document —
  all four already exist on every `Ticket` (see `types/index.ts`); no join to the parent `orders`
  document is needed for this feature, since `amount` is already duplicated onto the position (see
  `createOrderWithPosition`'s header comment on why `amount`/`purchasedAt` are on both).
- Server-only: this function imports `firebase-admin/firestore`, same as every other function
  already in `lib/orders.ts`. It must never be imported into a `'use client'` file — A7's `next
  build` is the regression guard for that boundary violation (Next's bundler rejects a
  Node-only/Admin-SDK import reaching client code at build time).

## Buyer details rendered on the page

Render, for the confirmed state only: attendee name, ticket type, amount (formatted however the
page already formats currency elsewhere in this codebase — check for an existing formatter before
inventing one), and the booking ref (already rendered today as plain text — keep it, in addition
to the QR, since a human at the door can still read it aloud if a scanner fails).

## Download format decision — composited PNG, not PDF

**Decision: a client-side Canvas-composited PNG "ticket card," downloaded via a normal
`<a download>` blob URL. Not a PDF.**

Reasoning:
- **No new dependency.** `lib/qr.ts` already produces the QR as a PNG data URI. The browser's
  native `<canvas>` API (already available, zero install) can composite that QR image plus text
  (attendee name, ticket type, booking ref) into a single flat PNG via `canvas.toBlob()`. A PDF
  route needs a new library (`jspdf`, `@react-pdf/renderer`, `pdf-lib`, or a server-side
  Puppeteer/headless-Chrome PDF render) — real weight for a feature whose actual job is "attendee
  has a picture they can pull up and scan."
- **Matches the real use case better than a PDF.** The team-lead's brief is explicit: "the real
  use case" is a phone at a venue entrance. A saved PNG lands directly in the phone's Photos app —
  visible instantly, including offline, at full brightness, with one thumb-swipe. A saved PDF
  requires a PDF viewer app to open, is usually slower to reach from a lock screen, and buys
  nothing extra here (no multi-page content, no print layout requirement at the door).
  A print-optimized stylesheet was also considered and rejected for the same reason: printing at
  a walk-up show entrance is not the realistic flow this feature is fixing.
- **The composited artifact must stay independently scannable — this is the one real
  implementation risk.** `jsQR` (and QR readers generally) need a clean quiet zone (blank margin)
  around the QR code to detect it reliably. Implementer requirement: when compositing the QR onto
  the canvas alongside attendee text, leave **at least 16px of unobstructed white/background space
  on all four sides of the QR image**, and do not draw any text or graphic on top of the QR itself.
  A6's download sub-case decodes the downloaded PNG with `jsqr`/`pngjs` end-to-end specifically to
  catch a composite that looks fine visually but no longer decodes.
- **Client-side component.** A small `'use client'` component (e.g.
  `components/tickets/DownloadTicketButton.tsx`) receiving `{ bookingRef, attendeeName,
  ticketType, qrDataUri }` as props from the Server Component's confirmed branch. On click: draw
  to an offscreen `<canvas>`, `canvas.toBlob()`, create an object URL, click a temporary
  `<a download="saoc-ticket-<bookingRef>.png">`, revoke the object URL after. No new dependency,
  no network call, no server route.

## Acceptance protocol (@qa runs `execution/checks/verify_confirmation_page.ts` via tsx)

The script takes `--paid-ref <real booking ref>` and `--bad-ref <nonexistent booking ref>`.

1. **Setup**: run `next build`, then `next start` on an ephemeral port (or reuse an already-running
   dev/build server if the harness provides one — implementer's choice, but the script must be
   runnable standalone with no other process already up, since contract assertions run
   independently). Wait for the server to accept connections before proceeding. Tear the server
   down on exit, including on failure (no orphaned process left listening).
2. **Independent fixture lookup**: before touching the browser, use the same Firestore REST helper
   pattern as `execution/checks/_firestore_rest.py` (a TypeScript/Node equivalent, or shell out to
   a small Python helper) to read `tickets/{paid-ref}` directly and record its real
   `attendeeName`/`ticketType`/`bookingRef`. Do NOT hardcode expected fixture values in the script
   — the golden's A6 requires this so the check keeps passing if the fixture ticket's name/type is
   ever edited, and keeps failing honestly if the page renders something else.
3. **Paid-ref case**: navigate Playwright to `/tickets/confirmation?ref=<paid-ref>`. Locate the
   rendered QR `<img>`, read its `src` (a `data:image/png;base64,...` URI), decode the base64 PNG
   with `pngjs`, run `jsqr` against the decoded pixels, and assert the decoded text is **exactly**
   the paid ref. Assert the page's rendered text contains the independently-looked-up
   `attendeeName` and `ticketType`.
4. **Download case**: on the same paid-ref page, trigger the download control and use
   Playwright's `page.waitForEvent('download')` to capture the resulting file. Save it, decode it
   the same way (`pngjs` + `jsqr`), and assert the decoded text is again exactly the paid ref —
   proving the downloaded artifact is independently re-scannable, not a decorative screenshot.
5. **Bad-ref case**: navigate to `/tickets/confirmation?ref=<bad-ref>`. Assert no QR `<img>` is
   rendered and none of the independently-looked-up-style PII strings appear — i.e., the
   not-found/pending UI renders, exactly as it does today for an unknown ref, and the server-side
   lookup fails closed rather than leaking a stale QR or placeholder details.
6. Any failed expectation exits non-zero and names exactly which of the above cases failed —
   matching `execution/checks/verify_reply_to.ts`'s existing per-case failure-reporting
   convention. No sub-case may be silently skipped on an unrelated setup error; a setup failure
   (server never came up, Firestore lookup failed) must also exit non-zero with a distinct message
   so it isn't confused with a real behavioral failure.

## `execution/checks/verify_confirmation_fields.py` (A5)

A thin, Python, REST-based prerequisite check — same auth pattern as
`execution/checks/verify_order_paid.py` (reuse `_firestore_rest.py`'s `connect()` /
`get_document()`, read-only, no `dotenv`). Takes `--booking-refs <comma-separated refs>`. For each
ref: fetch `tickets/{ref}`, assert it exists, assert `attendeeName`/`ticketType`/`bookingRef` are
non-empty strings, `amount` is a positive number, and `status` is `paid` or `checked-in`. Exit 0
only if every ref passes every check; otherwise print which ref/field failed and exit 1. Exit 2
(not 1) only for setup/auth failures unrelated to the defect under test, matching
`verify_order_paid.py`'s existing exit-code convention.

## Non-goals

- No change to `/api/tickets/status`'s response shape — still `{ status }` only.
- No change to `lib/email.ts`, `TICKETS_FROM_ADDRESS`, or any Resend domain/DNS configuration
  (item 4 of Brad's instruction — tracked separately, already decided against for now).
- No PDF generation, no wallet pass (Apple Wallet / Google Wallet), no print stylesheet.
- No change to `lib/qr.ts`'s QR generation itself (still the plain, unsigned `bookingRef`,
  confirmed-correct-as-designed per that file's own header comment) or to
  `emails/OrderConfirmation.tsx`'s existing email-side QR rendering.
- No change to `lib/checkin.ts` / the door-scanner admission logic — this feature only adds a
  second place (the page, and now a downloaded file) where the SAME unsigned booking-ref QR is
  presented; the admission rules and lookup-by-`bookingRef` behavior are untouched.
