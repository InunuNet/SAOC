---
feature: D1
title: Resend email provider + React Email templates — golden reference
date: 2026-06-13
---

# D1 Golden Reference

## lib/email.ts

- Imports `Resend` from `resend`
- Instantiates `const resend = new Resend(process.env.RESEND_API_KEY)`
- Exports `sendEmail({ to, subject, react })` — async function
- Uses `process.env.RESEND_FROM_ADDRESS` (fallback: `'noreply@saoc.co.za'`)
- Calls `resend.emails.send({ from, to, subject, react })`
- On error: throws `new Error(...)` with Resend error message
- This module is server-only — never imported by client components

## emails/TicketConfirmation.tsx

- Default export: React Email component
- Props interface: `{ bookingRef: string; ticketType: string; attendeeName: string; showName: string; showDate: string; showVenue: string }`
- Uses `@react-email/components`: `Html`, `Head`, `Body`, `Container`, `Text`, `Heading`, `Hr`, `Preview`
- `<Preview>` text: references show name
- Displays booking reference prominently
- Includes QR placeholder text e.g. "Present this email at the door"
- Note about PDF ticket: future feature

## emails/ContactConfirmation.tsx

- Default export: React Email component
- Props interface: `{ name: string; subject: string }`
- Confirms receipt of message
- Includes exact text: "2 business days" for response time
- SAOC branding, professional tone

## app/api/contact/route.ts changes

- Adds import: `import { sendEmail } from '@/lib/email'`
- Adds import: `import { ContactConfirmation } from '@/emails/ContactConfirmation'`
- After successful Firestore write, wraps email send in try/catch:
  ```
  try {
    await sendEmail({ to: email, subject: 'We received your message', react: <ContactConfirmation name={name} subject={subject} /> });
  } catch (emailErr) {
    console.error('[contact/route] email send failed (non-fatal):', emailErr);
  }
  ```
- Response is always 201 on Firestore success — email failure is non-blocking
- JSX in route.ts requires `react` import or Next.js JSX transform

## Non-negotiable rules

- `RESEND_API_KEY` is never committed — stays in `.env.local` only
- `.env.local.example` must have `RESEND_API_KEY=` and `RESEND_FROM_ADDRESS=` entries
- No client-side imports of `lib/email.ts` or `resend`
