---
schema: athanor.mission/v1
slug: vendor-form-input-focus-indicators
goal: 'Fix vendor registration form: no visible focus indicator on ~24 of ~40 interactive
  elements -- every text/number/email/tel/url/textarea input relies on a barely-perceptible
  border-colour shift with outline: none. Checkboxes, radios, submit and nav links
  are already correct. Isolated to text-type inputs. Add a visible focus-visible ring
  treatment matching the pattern already used elsewhere on this site (e.g. the ring
  classes used on ContactForm/TicketFormField inputs, or the stepper-button ring pattern
  fixed in a recent mission -- reuse whatever is the established site convention,
  do not invent a new ring style). Apply consistently across all vendor form text-type
  inputs. Verify with real BrowserAgent keyboard Tab-through screenshots showing the
  ring renders on every affected input type. Route through @architect for contract
  + goldens.'
created_at: '2026-08-25T11:22:38.155400+00:00'
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
  title: Vendor form text-type inputs get the site-default focus-visible ring
  inline_brief: null
  contract: .agent/memory/project/specs/vendor-form-input-focus-indicators/contract-f1.yaml
  golden_files:
  - contracts/golden/vendor-form-input-focus-indicators-f1/README.md
  completed_at: null
  spec: .agent/memory/project/specs/vendor-form-input-focus-indicators/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T11:34:12.308618+00:00'
  gate_result: pass
---





# Mission: Fix vendor registration form: no visible focus indicator on ~24 of ~40 interactive elements -- every text/number/email/tel/url/textarea input relies on a barely-perceptible border-colour shift with outline: none. Checkboxes, radios, submit and nav links are already correct. Isolated to text-type inputs. Add a visible focus-visible ring treatment matching the pattern already used elsewhere on this site (e.g. the ring classes used on ContactForm/TicketFormField inputs, or the stepper-button ring pattern fixed in a recent mission -- reuse whatever is the established site convention, do not invent a new ring style). Apply consistently across all vendor form text-type inputs. Verify with real BrowserAgent keyboard Tab-through screenshots showing the ring renders on every affected input type. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes

