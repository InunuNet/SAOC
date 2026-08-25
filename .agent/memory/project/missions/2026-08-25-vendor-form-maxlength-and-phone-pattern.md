---
schema: athanor.mission/v1
slug: vendor-form-maxlength-and-phone-pattern
goal: No maxlength on any of the 25 vendor form fields (5000 chars accepted into businessName
  with no truncation or warning) and no pattern on the phone field -- type=tel accepts
  'not a phone number !!' verbatim. Add sensible maxlength attributes per field and
  a pattern/client-side format check for the phone field, consistent with the form's
  existing validation and error-display conventions.
created_at: '2026-08-25T11:56:59.036046+00:00'
started_at: null
status: close_out
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  status: pending
  tier: standard
  title: Vendor form field maxlength caps + phone format validation (client + server)
  inline_brief: null
  contract: .agent/memory/project/specs/vendor-form-maxlength-and-phone-pattern/contract-f1.yaml
  golden_files:
  - contracts/golden/vendor-form-maxlength-and-phone-pattern-f1/README.md
  completed_at: null
  spec: .agent/memory/project/specs/vendor-form-maxlength-and-phone-pattern/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T12:15:44.695974+00:00'
  gate_result: pass
---




# Mission: No maxlength on any of the 25 vendor form fields (5000 chars accepted into businessName with no truncation or warning) and no pattern on the phone field -- type=tel accepts 'not a phone number !!' verbatim. Add sensible maxlength attributes per field and a pattern/client-side format check for the phone field, consistent with the form's existing validation and error-display conventions.

## Context

(Add context here)

## Notes

