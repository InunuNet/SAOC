---
schema: athanor.mission/v1
slug: vendor-form-client-validation-gate
goal: 'Fix vendor registration form: no client-side validation gating submission.
  checkValidity() correctly flags empty required fields and whitespace-only text,
  but nothing in the submit handler checks it before firing the network request --
  a fully empty form POSTs. All rejection is currently server-side with no client
  backstop. Wire the submit handler to call the forms existing checkValidity()/reportValidity()
  (or equivalent) before allowing the POST; on failure, block submission and surface
  the errors the same way the form already displays validation errors elsewhere (do
  not invent a new error-display pattern). Server-side validation stays as the authoritative
  check -- this is a client backstop/UX improvement only, not a replacement. Verify
  with real BrowserAgent: submit an empty form and confirm no network request fires
  and errors are shown; submit a valid form and confirm it still successfully POSTs.
  Route through @architect for contract + goldens.'
created_at: '2026-08-25T10:21:05.228782+00:00'
started_at: null
status: done
completed_at: '2026-08-25T10:42:42.794211Z'
last_active_at: '2026-08-25T10:42:42.794211Z'
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
  title: Regression-lock and BrowserAgent verification of the existing vendor form
    client-side validation gate
  inline_brief: 'Investigation (@architect, 2026-08-25) found the defect described
    in this mission''s goal does not exist in current committed source: handleSubmit()
    in components/vendors/VendorRegisterForm.tsx already runs validateVendorRegisterFormClientSide(state)
    before the fetch(''/api/vendors/register'') call, returns early on any client
    error, and renders errors through the form''s existing VendorRegisterStatusBanner
    error-display path. Server-side validation remains untouched and authoritative.
    No production code fix is expected. This feature is a regression-lock: @dev writes
    structural + Playwright behavioral check scripts (real browser, real network interception)
    proving an empty/invalid submit fires zero network requests and shows visible
    errors, and a fully valid submit still fires exactly one POST and succeeds --
    plus a real BrowserAgent pass, screenshotted, covering both paths. Full detail:
    contracts/golden/vendor-form-client-validation-gate-f1/README.md.'
  contract: .agent/memory/project/specs/vendor-form-client-validation-gate/contract-f1.yaml
  golden_files:
  - contracts/golden/vendor-form-client-validation-gate-f1/README.md
  - contracts/golden/vendor-form-client-validation-gate-f1/handleSubmit.expected.tsx.txt
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T10:40:59.546119+00:00'
  gate_result: pass
---



# Mission: Fix vendor registration form: no client-side validation gating submission. checkValidity() correctly flags empty required fields and whitespace-only text, but nothing in the submit handler checks it before firing the network request -- a fully empty form POSTs. All rejection is currently server-side with no client backstop. Wire the submit handler to call the forms existing checkValidity()/reportValidity() (or equivalent) before allowing the POST; on failure, block submission and surface the errors the same way the form already displays validation errors elsewhere (do not invent a new error-display pattern). Server-side validation stays as the authoritative check -- this is a client backstop/UX improvement only, not a replacement. Verify with real BrowserAgent: submit an empty form and confirm no network request fires and errors are shown; submit a valid form and confirm it still successfully POSTs. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes

