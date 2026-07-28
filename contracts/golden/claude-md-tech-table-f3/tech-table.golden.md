| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router, TypeScript) | RSC-first, Firebase App Hosting native SSR support |
| Styling | Tailwind CSS v4 | CSS-first config, no tailwind.config.ts needed |
| Hosting | Firebase App Hosting | Native Next.js SSR, same ecosystem as Firestore |
| CMS | Sanity (Studio at `/studio`) | Structured content editing (events, national show, media kit, etc.) via `next-sanity` |
| Database | Firestore | Contact submissions, ticket sales/check-in, event submissions |
| Auth | Firebase Auth | Email/password login for `/admin`, session cookies via `firebase-admin/auth` |
| Forms | API route → Firestore + Resend | Contact and event submissions written to Firestore; confirmation email sent via Resend |
| Payments | PayFast (sandbox) | Ticket checkout + ITN webhook verification (`lib/payfast.ts`) |
| Package manager | pnpm | Faster, stricter hoisting |
