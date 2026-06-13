# D1 Golden — Resend email provider + React Email templates

Reference for correct D1 output. Contract: `contracts/contract-d1-resend-email.yaml`.

## Scope boundary

D1 adds transactional email plumbing only. It must NOT touch brand colours,
fonts, or visual tokens (those arrive via Claude Design handoffs). Templates use
React Email defaults / inline structural markup, no invented brand assets.

---

## 1. `lib/email.ts` — Resend wrapper (server-only)

**Must export:** an async `sendEmail` function.

**Signature:**
```ts
export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string;
  subject: string;
  react: JSX.Element;
}): Promise<void>
```

**Behaviour:**
- Instantiates a module-level singleton: `const resend = new Resend(process.env.RESEND_API_KEY)`.
- Imports `Resend` from `'resend'`.
- Resolves the sender from `process.env.RESEND_FROM_ADDRESS`, with a sensible
  fallback (e.g. `'SAOC <noreply@saoc.co.za>'`).
- Calls `resend.emails.send({ from, to, subject, react })`.
- **Error handling:** if the Resend response carries an `error`, it THROWS
  (`throw new Error(...)`). The function itself does not swallow errors — the
  CALLER decides whether a failure is fatal. This keeps the util pure and lets
  `/api/contact` make the non-blocking decision.
- Server-only: env vars have NO `NEXT_PUBLIC_` prefix; this module is only ever
  imported by API routes / server code, never by client components.

**Env vars (also added to `.env.local.example`):**
```
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_ADDRESS=SAOC <noreply@saoc.co.za>
```

---

## 2. `emails/TicketConfirmation.tsx` — React Email component

**Props (all six required):**
`bookingRef`, `ticketType`, `attendeeName`, `showName`, `showDate`, `showVenue`
— all `string`.

**Must render:**
- Imports structural components from `@react-email/components`
  (`Html`, `Head`, `Body`, `Container`, `Text`, `Heading`, `Hr`, `Preview`).
- A `<Preview>` line (e.g. "Your ticket for {showName}").
- A heading confirming the booking ("Booking Confirmed" or similar).
- Greets the attendee by `attendeeName`.
- Surfaces `bookingRef`, `ticketType`, `showName`, `showDate`, `showVenue`.
- A QR placeholder block whose text contains the literal phrase
  **"present this email at the door"** (case-insensitive match in contract).
- Named export `TicketConfirmation` AND a `default` export of the same component.

---

## 3. `emails/ContactConfirmation.tsx` — React Email component

**Props (both required):** `name`, `subject` — both `string`.

**Must render:**
- Imports from `@react-email/components`.
- A `<Preview>` line ("We received your message" or similar).
- A heading ("Message Received" or similar).
- Greets the sender by `name`.
- References the `subject` of their enquiry.
- Text stating the reply window contains the literal phrase **"2 business days"**.
- Named export `ContactConfirmation` AND a `default` export.

---

## 4. `app/api/contact/route.ts` — non-blocking email wiring

**Pattern — email is best-effort, never blocks the response:**

1. Existing Firestore write to `contactSubmissions` happens FIRST and unchanged.
2. AFTER the Firestore write succeeds, attempt the confirmation email:
   ```ts
   try {
     await sendEmail({
       to: email,
       subject: 'We received your message',
       react: <ContactConfirmation name={name} subject={subject} />,
     });
   } catch (emailErr) {
     console.error('[contact/route] Email send failed (non-fatal):', emailErr);
   }
   ```
3. The route ALWAYS returns `201` on Firestore success, regardless of whether the
   email send threw. An email failure is logged, never propagated to the client.
4. Import is `import { sendEmail } from '@/lib/email'` (or relative `lib/email`).

**Invariants:**
- A failing Resend call must NOT change the HTTP status or the JSON body the
  client receives on a successful submission.
- No `await` on the email outside the try/catch.
- Firestore failure path (existing 4xx/5xx) is untouched by D1.

---

## Gates (must all pass)

- `pnpm type-check` — strict TS, zero errors (templates are valid JSX; `react`
  prop typed as `JSX.Element`).
- `pnpm lint` — zero errors.
- `pnpm build` — succeeds (note: `emails/` is excluded from the client bundle;
  templates render server-side only).

## Out of scope for D1 (do not implement)

- SPF/DKIM/DMARC DNS records on saoc.co.za — pre-launch checklist (backlog).
- Wiring TicketConfirmation into any booking route — that is a later feature;
  D1 only builds the template + util and wires the CONTACT confirmation.
- Any brand styling / design tokens.
