---
schema: athanor.mission/v1
slug: firestore-undefined-write-safety
goal: 'Fix the defect class where buildVendorSubmission and sibling builders assign
  omitted optional inputs as own properties with value undefined, which routes then
  spread into Firestore .add()/.set(). The Firebase Admin SDK throws on undefined
  values and ignoreUndefinedProperties is set nowhere in lib/ or app/, so a payload
  that omits an optional key passes validation and then fails at persistence - the
  worst failure shape, because the submission looks accepted until the write. Masked
  today only because the registration UI posts empty strings for every optional field;
  a direct API call or any caller that omits a key hits it. Found 2026-09-01 by the
  mandatory Codex pass during vendor-gated-registration-flow M2, logged P1. Scope:
  a RED check first, proving a minimal valid submission with optional fields genuinely
  absent round-trips to Firestore; then the fix at the right layer (initAdmin ignoreUndefinedProperties
  vs stripping in the builders - the check must not care which); then audit the sibling
  builders sharing the build-then-spread shape: vendorApplications, orders/tickets,
  and the M3 stand-payment path.'
created_at: '2026-09-01T13:06:04.265204+00:00'
started_at: null
last_active_at: '2026-09-01T13:31:04.831969+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-09-01T13:30:36.568705+00:00'
features:
- id: F1
  status: done
  tier: standard
  title: Fix the Firestore undefined-value write defect in buildVendorSubmission()
    and buildVendorApplication(), proven by A1/A2 going green
  inline_brief: null
  spec: contracts/contract-firestore-undefined-write-safety.yaml
  contract: contracts/contract-firestore-undefined-write-safety.yaml
  completed_at: '2026-09-01T13:30:36.568552+00:00'
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-09-01T13:30:44.154121+00:00'
  gate_result: pass
completed_at: '2026-09-01T13:31:04.831766+00:00'
---

# Mission: Fix the defect class where buildVendorSubmission and sibling builders assign omitted optional inputs as own properties with value undefined, which routes then spread into Firestore .add()/.set(). The Firebase Admin SDK throws on undefined values and ignoreUndefinedProperties is set nowhere in lib/ or app/, so a payload that omits an optional key passes validation and then fails at persistence - the worst failure shape, because the submission looks accepted until the write. Masked today only because the registration UI posts empty strings for every optional field; a direct API call or any caller that omits a key hits it. Found 2026-09-01 by the mandatory Codex pass during vendor-gated-registration-flow M2, logged P1. Scope: a RED check first, proving a minimal valid submission with optional fields genuinely absent round-trips to Firestore; then the fix at the right layer (initAdmin ignoreUndefinedProperties vs stripping in the builders - the check must not care which); then audit the sibling builders sharing the build-then-spread shape: vendorApplications, orders/tickets, and the M3 stand-payment path.

## Context

(Add context here)

## Notes

