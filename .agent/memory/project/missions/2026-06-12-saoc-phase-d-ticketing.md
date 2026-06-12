---
schema: athanor.mission/v1
slug: saoc-phase-d-ticketing
goal: 'Deliver SAOC Phase D: 2027 National Show ticketing — Resend email (D1), Firestore
  ticket model (D3), buy flow (D4), admin dashboard (D5), door check-in (D6). D2 (Stripe
  SA gateway) blocked pending Brad account.'
created_at: '2026-06-12T19:42:29.290108+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 5
  milestones: 1
  total_calls: 8
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: D1
  title: Resend email provider install + React Email templates
  status: pending
  started_at: null
  completed_at: null
- id: D2
  title: Stripe SA payment gateway integration
  status: blocked
  started_at: null
  completed_at: null
- id: D3
  title: Firestore ticket model (TypeScript types + collection schema)
  status: pending
  started_at: null
  completed_at: null
- id: D4
  title: Buy flow — /shows/2027-national/tickets page + Stripe redirect
  status: blocked
  started_at: null
  completed_at: null
- id: D5
  title: Admin dashboard — /admin route with Firebase Auth custom claims
  status: pending
  started_at: null
  completed_at: null
- id: D6
  title: Door check-in — /admin/door mobile-first QR scanner
  status: pending
  started_at: null
  completed_at: null
milestones:
- id: MD
  title: Phase D complete (all unblocked features done)
  features: [D1, D3, D5, D6]
---

# Mission: SAOC Phase D — 2027 National Show Ticketing

## Context

Phase A (foundation), Phase B (CMS pages), and Phase C (events calendar) are complete.
Phase D delivers the 2027 National Show ticketing system.

D2 (Stripe SA) and D4 (buy flow) are BLOCKED pending Brad's Stripe SA account setup.
D1, D3, D5, D6 can proceed now.

**Mandatory chain for every feature:**
`@architect (contract+goldens) → @dev → @qa → @docs → contract gate → @maintainer`

## Phase D scope

- **D1**: Install Resend SDK (`resend` + `@react-email/components`). Create `lib/email.ts` utility. Build `emails/TicketConfirmation.tsx` React Email template (booking ref, ticket type, QR placeholder, PDF attachment note). Build `emails/ContactConfirmation.tsx` for contact form. Wire `/api/contact` to send via Resend instead of placeholder.
- **D2**: BLOCKED — Stripe SA account not set up. Skip until Brad confirms.
- **D3**: TypeScript types for `Ticket`, `TicketType`, `TicketStatus` in `types/index.ts`. Firestore collection `tickets` schema doc. No purchase flow yet — just the model.
- **D4**: BLOCKED — depends on D2 (Stripe).
- **D5**: `/admin` route with Firebase Auth + custom claims (`role: admin`). Ticket list table (read from Firestore), attendee CSV export. Skeleton only (no refund handler until D2 live).
- **D6**: `/admin/door` mobile-first QR scanner using `html5-qrcode`. Scan → lookup ticket in Firestore → mark `checkedInAt` → visual confirm. Manual reference lookup as fallback.

## Notes

- D2/D4 gate: when Brad sets up Stripe SA, activate D2 then D4.
- SPF/DKIM/DMARC on saoc.co.za needed before D1 emails go to production — add to pre-launch checklist.
