---
schema: athanor.mission/v1
slug: payfast-ticketing
goal: 'Integrate PayFast as the SAOC 2027 National Show ticketing payment gateway
  (D2/D4): rework the Firestore ticket schema off its Stripe-shaped field, build checkout
  against PayFast''s Sandbox, and complete the buy flow (checkout UI, purchase confirmation,
  ticket write, email confirmation)'
created_at: '2026-07-01T22:01:54.627382+00:00'
started_at: null
last_active_at: '2026-07-28T17:13:51.270626+00:00'
status: paused
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F3
  ts: '2026-07-03T21:24:20.840322+00:00'
features:
- id: F1
  title: Rework Firestore ticket schema off Stripe-shaped field for PayFast
  status: done
  inline_brief: 'docs/firestore-ticket-schema.md and the ticket type currently have
    a stripePaymentIntentId field left over from earlier D2 exploration under Stripe.
    Replace with PayFast-shaped fields: m_payment_id (our own order reference, sent
    to PayFast and echoed back), pf_payment_id (PayFast''s own payment ID, from the
    ITN callback), and keep the existing status lifecycle (reserved/paid/cancelled/
    checked-in). Update docs/firestore-ticket-schema.md to match. No UI changes in
    this feature.

    '
  completed_at: '2026-07-03T21:24:20.254795+00:00'
- id: F2
  title: PayFast checkout initiation route
  status: done
  inline_brief: 'Server-side API route that builds a PayFast redirect checkout: constructs
    the payment form fields (merchant_id, merchant_key, amount, item_name, m_payment_id,
    return_url, cancel_url, notify_url), generates the MD5 signature per PayFast''s
    spec (with passphrase), and returns the redirect target. Use env vars PAYFAST_SANDBOX_MERCHANT_ID
    / PAYFAST_SANDBOX_MERCHANT_KEY / PAYFAST_SANDBOX_PASSPHRASE (sandbox.payfast.co.za
    as the target host). Creates a Firestore ticket doc in ''reserved'' status before
    redirecting.

    '
  completed_at: '2026-07-03T21:24:20.556572+00:00'
- id: F3
  title: PayFast ITN (Instant Transaction Notification) handler
  status: done
  inline_brief: 'API route PayFast POSTs to on payment completion. Must validate the
    notification per PayFast''s documented ITN security checks (signature match, source
    IP allowlist, server confirmation callback to PayFast, amount match against the
    reserved ticket). On valid + COMPLETE status, update the Firestore ticket doc
    to ''paid'' and store pf_payment_id. On failure, log and leave ticket in ''reserved''
    (do not silently mark paid on unverified callbacks — this is a payment security
    boundary).

    '
  completed_at: '2026-07-03T21:24:20.839913+00:00'
- id: F4
  title: Ticket buy flow UI
  status: pending
  inline_brief: 'Public-facing buy flow: ticket tier selection (Adult/Pensioner/Child/Member/
    Exhibitor per the proposal''s tier names), quantity picker, order summary, and
    a checkout button that POSTs to the F2 initiation route and redirects to PayFast.
    Use placeholder prices flagged clearly in code comments until real 2027 pricing
    is confirmed (logged in needs-human.md). Mobile-first, loading + error states
    per project coding standards.

    '
- id: F5
  title: Purchase confirmation page + email
  status: pending
  inline_brief: 'return_url landing page showing order confirmation (pending final
    ITN confirmation — do not claim payment success until F3 has processed the ITN;
    show a "processing" state if the ticket is still ''reserved'' when the user lands
    here). Resend email confirmation sent once status flips to ''paid'', reusing the
    existing email pattern from D1.

    '
- id: F6
  title: Sandbox end-to-end verification + build check
  status: pending
  inline_brief: 'Manual test transaction through PayFast Sandbox covering the full
    path: buy flow -> checkout redirect -> sandbox payment -> ITN received and verified
    -> Firestore ticket flips to paid -> confirmation email sent. Also run pnpm build
    clean. Depends on PAYFAST_SANDBOX_* credentials being supplied (needs-human.md).

    '
milestones:
- id: M1
  title: Payment plumbing — schema, checkout initiation, ITN handler
  features:
  - F1
  - F2
  - F3
  status: done
  gate_ran_at: '2026-07-03T21:24:33.083017+00:00'
  gate_result: pass
- id: M2
  title: Buy flow UI, confirmation, sandbox-verified
  features:
  - F4
  - F5
  - F6
  status: pending
---






# Mission: Integrate PayFast as the SAOC 2027 National Show ticketing payment gateway (D2/D4): rework the Firestore ticket schema off its Stripe-shaped field, build checkout against PayFast's Sandbox, and complete the buy flow (checkout UI, purchase confirmation, ticket write, email confirmation)

## Context

Prior D2/D4 exploration assumed Stripe as the gateway (BLOCKED, never built) and left a
stripePaymentIntentId field in the Firestore ticket schema. Gateway decision changed
2026-07-03: Yoco is waitlisted with no ETA, PayFast is now the confirmed and committed
gateway — verified against PayFast's real developer docs (Subscriptions/Refunds API,
hosted redirect checkout, PCI DSS Level 1) and already communicated to the client
(SAOC Secretary) in the proposal evaluation response.

Brad has confirmed: build this regardless of whether SAOC approves the proposal, as a
learning exercise in using AI + best available free-tier tech to deliver strong outcomes
for NGOs/NPOs. Build against Inunu's own PayFast Sandbox account now; credentials will be
swapped to SAOC's own FICA-verified live PayFast account if/when the deal is won.

Blocking on Brad: PAYFAST_SANDBOX_MERCHANT_ID / _MERCHANT_KEY / _PASSPHRASE (free sandbox
signup, logged in needs-human.md) — blocks F6 (live sandbox test) only, not F1-F5.
Non-blocking: real 2027 ticket tier pricing (also logged in needs-human.md) — building
against placeholder prices in the meantime.

## Notes

