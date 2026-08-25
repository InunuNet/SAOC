---
schema: athanor.mission/v1
slug: form-error-contrast-remaining-components
goal: Extend the bordered-callout error-contrast fix to the remaining components.
  backlog-a11y-ui-quickfixes F3 (2026-08-21/22) applied a bordered-callout pattern
  to fix low-contrast text-accent error text on ContactForm and TicketPurchaseForm
  only. The same low-contrast text-accent error-text issue is still present on CartDayPicker,
  TicketFormField, and DownloadTicketButton. Apply the same bordered-callout treatment
  (read the F3 golden/contract for the exact pattern used, reuse it verbatim -- do
  not invent a new treatment) to these three remaining components. Verify contrast
  meets WCAG AA (4.5:1) with a real contrast check, and verify visually with real
  BrowserAgent screenshots that error states render correctly and consistently with
  the already-fixed components. Route through @architect for contract + goldens.
created_at: '2026-08-24T23:26:49.145595+00:00'
started_at: null
status: done
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
  name: Apply the F3 bordered-callout error pattern to CartDayPicker, TicketFormField,
    DownloadTicketButton
  status: pending
  spec: .agent/memory/project/specs/form-error-contrast-remaining-components
  contract: .agent/memory/project/specs/form-error-contrast-remaining-components/contract-f1.yaml
milestones:
- id: M1
  name: Bordered-callout error contrast on remaining components
  features:
  - F1
  status: done
  gate_ran_at: '2026-08-25T10:18:04.433626+00:00'
  gate_result: pass
completed_at: '2026-08-25T10:20:13.238415+00:00'
last_active_at: '2026-08-25T10:20:13.238613+00:00'
---





# Mission: Extend the bordered-callout error-contrast fix to the remaining components. backlog-a11y-ui-quickfixes F3 (2026-08-21/22) applied a bordered-callout pattern to fix low-contrast text-accent error text on ContactForm and TicketPurchaseForm only. The same low-contrast text-accent error-text issue is still present on CartDayPicker, TicketFormField, and DownloadTicketButton. Apply the same bordered-callout treatment (read the F3 golden/contract for the exact pattern used, reuse it verbatim -- do not invent a new treatment) to these three remaining components. Verify contrast meets WCAG AA (4.5:1) with a real contrast check, and verify visually with real BrowserAgent screenshots that error states render correctly and consistently with the already-fixed components. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes

