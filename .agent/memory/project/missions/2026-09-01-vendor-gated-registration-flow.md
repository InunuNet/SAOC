---
schema: athanor.mission/v1
slug: vendor-gated-registration-flow
goal: 'Gated vendor registration flow for the 2027 National Show, built against Lee-Ann''s
  26 Aug source document (docs/leeann-source/2027-vendor-registration-form_2026-08-26.md).
  Flow: short public application -> committee approval -> human-readable code (BusinessName-1234)
  -> token-gated full registration form -> committee review -> stand booking payment.
  M1 (F1-F8, apply/approve/tokenised link) SHIPPED fd51813. M2 F13 (14-item category
  list correction) SHIPPED 67d63ff/e439827. M4 (F22-F25, human-readable code with
  5-attempt lockout, CSPRNG, generation-bound session revocation) SHIPPED 5e3c9e6.
  REMAINING: M2 F14-F21 (rest of the field-set correction against the 26 Aug doc:
  online presence, booth sizes, chargeable tables/chairs, electricity and gas tables,
  7 typed vehicle fields, waste checkboxes, marketing uploads with exactly-3 photos,
  food certifications, insurance, 6-point declaration + 14-clause T&Cs, signature
  block) and M3 F26-F32 (stand booking payment, contracted, ships with prices null
  and refuses at the one point a real figure is missing). Contract: contracts/contract-vendor-gated-registration-flow.yaml.
  Council-blocked: stand fee figure absent entirely (the Booth Fees section was REMOVED
  from the source doc), 90-day vs 2-month cancellation contradiction, tables/chairs
  priced vs ''no extra charge'' voice note.'
created_at: '2026-09-01T00:01:15.874357+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features: []
milestones: []
---

# Mission: Gated vendor registration flow for the 2027 National Show, built against Lee-Ann's 26 Aug source document (docs/leeann-source/2027-vendor-registration-form_2026-08-26.md). Flow: short public application -> committee approval -> human-readable code (BusinessName-1234) -> token-gated full registration form -> committee review -> stand booking payment. M1 (F1-F8, apply/approve/tokenised link) SHIPPED fd51813. M2 F13 (14-item category list correction) SHIPPED 67d63ff/e439827. M4 (F22-F25, human-readable code with 5-attempt lockout, CSPRNG, generation-bound session revocation) SHIPPED 5e3c9e6. REMAINING: M2 F14-F21 (rest of the field-set correction against the 26 Aug doc: online presence, booth sizes, chargeable tables/chairs, electricity and gas tables, 7 typed vehicle fields, waste checkboxes, marketing uploads with exactly-3 photos, food certifications, insurance, 6-point declaration + 14-clause T&Cs, signature block) and M3 F26-F32 (stand booking payment, contracted, ships with prices null and refuses at the one point a real figure is missing). Contract: contracts/contract-vendor-gated-registration-flow.yaml. Council-blocked: stand fee figure absent entirely (the Booth Fees section was REMOVED from the source doc), 90-day vs 2-month cancellation contradiction, tables/chairs priced vs 'no extra charge' voice note.

## Context

(Add context here)

## Notes

