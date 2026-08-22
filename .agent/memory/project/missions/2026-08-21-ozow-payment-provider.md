---
schema: athanor.mission/v1
slug: ozow-payment-provider
goal: 'Add Ozow as a second PaymentProvider alongside PayFast (lib/payments/ seam)
  — sandbox credentials already staged in .env.local, merchant account INU-INU-002
  already Active. Brad''s explicit P1 direction 2026-08-21: Ozow is the client''s
  preferred gateway, not just a candidate. Design must resolve concurrent-provider
  selection (today''s seam is a single hardcoded const, not a registry) and implement
  Ozow''s own initiate/verify/confirm/refund per the PaymentProvider interface in
  lib/payments/types.ts, preserving PayFast''s existing behaviour untouched.'
created_at: '2026-08-21T20:05:20.175843+00:00'
started_at: '2026-08-22T02:15:00+00:00'
last_active_at: '2026-08-22T02:15:00+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-22T02:15:00+00:00'
features:
- id: F1
  status: done
  tier: apex
  title: Ozow adapter skeleton — signature builder + PaymentProvider implementation,
    proven against sandbox in isolation
  inline_brief: 'Build lib/ozow.ts (plain-SHA512 signature builder: ordered concat
    + private key + lowercase + SHA512 — verified against Ozow''s public integration
    docs via Alembic, NOT HMAC-SHA512 as docs/payment-gateway-research-2026-08.md
    incorrectly states; correct that doc as part of this feature) and lib/payments/ozow.ts
    (implements PaymentProvider from lib/payments/types.ts unchanged — architect confirmed
    every method holds for Ozow''s real field set, see .agent/memory/project/specs/ozow-payment-provider/spec.md).
    Status vocabulary is a 3-value enum (Complete/Cancelled/Error, no Pending) — mapStatus
    must handle this correctly. refund() stubbed not-supported (float/fee mechanics
    are still open vendor questions per docs/payment-gateway-research-2026-08.md,
    out of scope for sandbox work). Entirely additive/unreferenced code — zero checkout
    wiring, zero changes to lib/payments/index.ts or PayFast''s behaviour. Prove initiate()+notification
    round-trip against the REAL Ozow sandbox (credentials already in .env.local) —
    golden-pin the request/response shape, not a mock. Tier: apex — payment/money
    logic, same risk class as the original payment-provider-seam mission.'
  contract: null
  golden_files: []
- id: F2
  status: done
  tier: apex
  title: Checkout wiring — provider registry, providerId selection, split notification
    routes
  inline_brief: 'lib/payments/index.ts becomes a provider registry (Record<string,
    PaymentProvider> keyed by id) replacing the single hardcoded const — architect
    rejected an if/else-in-route (repeats the exact inversion payment-provider-seam
    F2 fixed) and a dynamic-import plugin registry (over-engineering for 2 known providers)
    in favour of this. app/api/tickets/checkout/route.ts validates providerId against
    an enumerated allow-list (same posture as isValidShowId) and stores it on the
    order — missing/invalid providerId is a 400, NEVER a silent PayFast default (explicit
    architect decision, must be a positive contract assertion). Notification routing:
    extract the shared verify/confirm/write-paid logic from app/api/tickets/itn/route.ts
    into a helper both routes call; PayFast''s route stays at its current path completely
    unchanged (regression-gate this — existing PayFast goldens must still pass unmodified);
    add a new thin app/api/tickets/ozow-itn/route.ts. Architect rejected a single
    shared route branching on a query param (trusting a URL segment as a routing hint
    creates an "unknown provider" state two dedicated routes make structurally impossible).
    Provider-choice UI is copy/markup only using existing design tokens — no new brand
    assets (CLAUDE.md rule); do not wait on a Claude Design handoff for a plain radio/toggle
    control. Tier: apex — touches live checkout money path.'
  contract: null
  golden_files: []
- id: F3
  status: pending
  tier: apex
  title: End-to-end sandbox proof, Codex pass, docs
  inline_brief: Full live sandbox purchase through Ozow end-to-end via BrowserAgent
    against the deployed dev site (same discipline as payment-provider-seam F3) —
    real browser, real sandbox redirect, real notification received and processed,
    ticket reaches paid. Mandatory Codex GPT-5.5 cross-model pass on the full diff
    (execution/codex_qa.sh) per .claude/rules/workflow.md. Update docs/payment-seam.md
    with the Ozow adapter; add a correction note to docs/payment-gateway-research-2026-08.md
    (HMAC-SHA512 → plain SHA512; refund request/response shape still unconfirmed from
    public docs, would need a live sandbox refund call to pin). Confirm PayFast purchases
    still work unaffected (non-regression, real purchase not just a contract assertion).
  contract: null
  golden_files: []
milestones:
- id: M1
  status: pending
  features:
  - F1
- id: M2
  status: pending
  features:
  - F2
- id: M3
  status: pending
  features:
  - F3
---


# Mission: Add Ozow as a second PaymentProvider alongside PayFast (lib/payments/ seam) — sandbox credentials already staged in .env.local, merchant account INU-INU-002 already Active. Brad's explicit P1 direction 2026-08-21: Ozow is the client's preferred gateway, not just a candidate. Design must resolve concurrent-provider selection (today's seam is a single hardcoded const, not a registry) and implement Ozow's own initiate/verify/confirm/refund per the PaymentProvider interface in lib/payments/types.ts, preserving PayFast's existing behaviour untouched.

## Context

Spec: .agent/memory/project/specs/ozow-payment-provider/spec.md (written by @architect
2026-08-21). Sandbox-only work — no live credentials, no going live, PayFast's existing
behaviour must not change. Deferred to backlog, not blocking this mission: real refund
implementation, settlement-timing/VAT/reserve-clause vendor confirmation, non-profit
onboarding for a real (non-sandbox) account, provider-choice UI visual design (waits for a
Claude Design handoff per CLAUDE.md's no-invented-brand-assets rule — F2 ships functional
markup only).

## Notes

Paused 2026-08-21 to let a higher-urgency live-site nav-menu investigation (Brad's direct
report) take the active-mission slot. Resume with `python3 execution/mission.py resume`.

