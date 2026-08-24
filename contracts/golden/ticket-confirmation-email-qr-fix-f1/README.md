# ticket-confirmation-email-qr-fix — F1 decision record

## The defect

The ticket confirmation email (`emails/OrderConfirmation.tsx`, sent by
`lib/confirmation-email.ts:sendConfirmationEmail`) shows a broken-image placeholder instead of
the QR code in Gmail, and likely other clients that strip or refuse to proxy `data:` URIs in
HTML email. Confirmed by reading the actual code (not assumed from the backlog note): the
current `<Img src={position.qrDataUri} .../>` renders the QR as a
`data:image/png;base64,...` URI produced by `lib/qr.ts:generateBookingRefQrDataUri` — this is a
genuine `data:` URI, not a remote URL, matching the backlog's "likely cause" exactly. QR
generation itself is correct — the same `generateBookingRefQrDataUri` output renders fine as a
plain `<img>` on `/tickets/confirmation` (a browser rendering its own DOM, not an email client
proxying untrusted HTML) and in the canvas-composited download
(`components/tickets/DownloadTicketButton.tsx`, also same-origin `<img>` load, never emailed).
This is exclusively an email-delivery defect in one template.

## Reconciling this with the F11 contract's prior decision

`contracts/golden/ticketing-f11-qr-confirmation-email/README.md` ("Inline data-URI vs.
attachment") already considered and rejected attachments, for reasons worth restating precisely
because this contract does not re-litigate them lightly:

- It named Outlook desktop as the client that strips `data:` URIs, and named **Gmail as one that
  renders them fine**. That assumption is now empirically wrong — Brad's live testing shows the
  defect in Gmail specifically. A design assumption that predicted the wrong failure mode is not
  a reason to keep the design; it is the reason to revisit it.
- The "attachments rejected" reasoning was about a **flat PDF/PNG attachment** — a separate file
  in the email's attachment list, multiplying attachment count with order size and being
  losslessly forwardable/screenshot-shareable at full resolution. A **CID-referenced inline
  attachment** (`Attachment.contentId` + `<img src="cid:...">`) is a materially different
  mechanism: it is not listed as a separate downloadable file in the clients that matter here, it
  renders inline exactly where the data URI used to render, and it does not change the
  QR's already-settled unsigned-secret security model (spec §7.1: the booking ref is a door
  code, not a wallet key — shareability was never the concern). The "spam scoring" and
  "forwardable at full resolution" objections were both scoped to the flat-attachment shape;
  neither applies differently to CID than to the `data:` URI already shipping today (a `data:`
  URI is exactly as forwardable/screenshottable as a CID-inline image).
- The visible-text `bookingRef` fallback F11 already built in (every position renders its
  booking reference as plain text, not just alt text) is UNCHANGED and UNREMOVED by this fix —
  it remains the safety net for any client that fails to render inline images at all, CID or
  `data:`.

This contract's position: the real, observed Gmail defect settles the question the prior
contract could previously only reason about hypothetically. Switching the QR from an inline
`data:` URI to a CID-referenced inline attachment is a strictly narrower, better-supported
mechanism for the same "QR is embedded directly in the email payload, never fetched or proxied"
goal both contracts already agreed on — it does not reopen the parts of F11's decision that
remain correct (one email per order, QR keyed on each position's own `bookingRef`, the visible
booking-reference fallback).

## The fix

### `lib/qr.ts` — new export, existing export untouched

`generateBookingRefQrDataUri` (used by `/tickets/confirmation`'s Server Component render, via
`lib/orders.ts`, and by the client-side canvas download in `DownloadTicketButton.tsx`) is
**not** touched, not renamed, not removed. Both of those consumers render the QR inside a
browser's own DOM/canvas, never inside an email client — they have no part in this defect and
must not regress.

A new function is added: `generateBookingRefQrPngBuffer(bookingRef: string): Promise<Buffer>`,
using the already-declared `qrcode` package's `toBuffer()` (PNG is `toBuffer`'s only supported
format, so no `type` option is needed). Same empty-`bookingRef`-refuses-synchronously contract
as `generateBookingRefQrDataUri`.

### `lib/email.ts` — `attachments` becomes a first-class, optional param

`Resend`'s Node SDK (`resend@6.12.4`, confirmed by reading
`node_modules/.pnpm/resend@6.12.4.../dist/index.d.mts`) already supports `attachments` as a
sibling field to `react`/`html`/`text` on `CreateEmailBaseOptions`:

```ts
interface Attachment {
  content?: string | Buffer;
  filename?: string | false;
  path?: string;
  contentType?: string;
  contentId?: string; // if set, sent as an inline attachment, referenced via `cid:` in HTML
}
```

`lib/email.ts` gains:

```ts
export interface EmailAttachment {
  content: Buffer;
  filename: string;
  contentType: string;
  contentId: string;
}
```

field names matching Resend's own `Attachment` fields exactly (no renaming layer to keep in
sync). `buildEmailPayload` and `sendEmail` both grow an optional `attachments?: EmailAttachment[]`
parameter, threaded straight into `getResend().emails.send({ ..., attachments })` unchanged when
provided, and **omitted entirely from the built payload object** when not provided — every
existing caller (`ContactConfirmation`, `VendorApprovalConfirmation`,
`VendorRegistrationConfirmation`, `ReconciliationAlert`) continues to build and send an identical
payload to today, byte for byte, with zero code change at those call sites.

### `lib/confirmation-email.ts` — per-position PNG attachment + CID reference

`SendConfirmationEmailDeps` gains one more independently-overridable member:
`generateQrPngBuffer?: (bookingRef: string) => Promise<Buffer>`, defaulting to
`generateBookingRefQrPngBuffer`. `ConfirmationEmailMailer.send`'s argument shape grows an
optional `attachments?: EmailAttachment[]` field (imported from `lib/email.ts`), matching the
real `sendEmail`'s new shape exactly — same "zero adapter code" property F10/F11 already
established for the mailer fake.

For each position, `sendConfirmationEmail` now:

1. Generates the PNG buffer via `generateQrPngBuffer(position.bookingRef)`.
2. Builds a content id: `` `qr-${position.bookingRef}` `` — `bookingRef` is always
   `SAOC-2027-` + 12 Crockford-base32 characters (`lib/booking-ref.ts`), which is only
   `[A-Z0-9-]`, a safe `Content-ID` value with no escaping needed, and unique per position within
   an order (each position has its own real ticket's booking ref), so no collision handling is
   needed across positions in the same email.
3. Pushes `{ content: buffer, filename: `qr-${bookingRef}.png`, contentType: 'image/png',
   contentId }` onto the outgoing `attachments` array.
4. Passes `qrContentId: contentId` (the bare id, no `cid:` prefix — the template adds it) into
   `OrderConfirmationPosition`, replacing the previous `qrDataUri: string` field.
5. Calls `mailer.send({ to, subject, react, attachments })` exactly once per order, as before —
   `attachments.length` always equals `positions.length`, in the same order as `positions`.

Every other behaviour F10/F11 already proved — refuses synchronously before any QR/mailer work
on an empty `positions` array, propagates (never swallows) a failure from either the QR
generator or the mailer, never logs `recoveryToken`, one email per order addressed to the buyer,
the F6 recovery link — is unchanged and re-asserted here because the function body changed, not
because the property itself is new.

### `emails/OrderConfirmation.tsx` — CID reference, not a data URI

`OrderConfirmationPosition.qrDataUri: string` becomes `OrderConfirmationPosition.qrContentId:
string`. The QR image becomes:

```tsx
<Img src={`cid:${position.qrContentId}`} alt={`QR code for booking reference ${position.bookingRef}`} width="200" height="200" />
```

The visible `bookingRef` text block, the recovery-link section, and every other part of the
template are untouched.

## Verification strategy — why "renders in a browser preview" is explicitly not trusted here

Per the mission brief's explicit instruction, no assertion in this contract treats rendering the
React template to an HTML string as proof of anything about email-client image display — that
already "passed" before the fix (the broken `data:` URI renders as valid HTML with a valid `src`
attribute; the failure is entirely inside Gmail's own image-handling, invisible to a DOM/string
render). The automated assertions below instead inspect the **actual outbound payload shape**:
what `mailer.send()` receives (attachments array, each with real decodable PNG bytes and a real
`contentId`) and what the rendered HTML's `<img src>` actually contains (a `cid:` reference
matching one of those `contentId`s, never a `data:` URI). That is the strongest proxy available
without a live send.

**What is NOT automatable, named explicitly (per coding.md's `agent_review` rule):** whether
Gmail (or any other real mail client) actually resolves a `cid:`-referenced inline attachment to
a displayed image, as opposed to a second broken-image placeholder for a different reason, can
only be proven by a real send to a real inbox and a human (or browser agent driving a real
webmail session) looking at it. A9 below is that check, explicitly flagged `agent_review`, not
silently skipped and not disguised as an automated pass.

## Explicitly out of scope

- `lib/orders.ts`'s existing `generateBookingRefQrDataUri` call (confirmation-page render path)
  — untouched, not this defect.
- `components/tickets/DownloadTicketButton.tsx` — untouched, not this defect.
- `app/api/tickets/itn/route.ts` — pinned by F10; its call site (`sendConfirmationEmail({...})`,
  one argument) is unaffected by this change and requires no edit.
- Any other Resend-sending module (`ContactConfirmation`, `VendorApprovalConfirmation`,
  `VendorRegistrationConfirmation`, `ReconciliationAlert`) — none of them pass `attachments`
  today and none need to; `lib/email.ts`'s change is additive and optional.
