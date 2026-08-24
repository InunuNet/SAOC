---
schema: athanor.mission/v1
slug: admin-settings-deploy-and-chrome-fix
goal: 'Fix /admin/settings: deploy to Firebase App Hosting (currently 404 on beta),
  add missing site chrome (UtilityBar/Header/AdminNav) to match every other admin
  page, and add a capability-gated nav link in AdminNav.buildLinks(). Root cause:
  F1''s dev/QA chain never opened the page in a real browser.'
created_at: '2026-08-24T11:17:12.292962+00:00'
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
  status: pending
  title: Add missing chrome + capability-gated nav link to /admin/settings, and prove
    the fix is live on beta.saoc.co.za via a real authenticated browser session (desktop
    + mobile), not just a structural source check.
  inline_brief: null
  spec: .agent/memory/project/specs/admin-settings-deploy-and-chrome-fix
  contract: .agent/memory/project/specs/admin-settings-deploy-and-chrome-fix/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-24T11:42:56.229814+00:00'
  gate_result: pass
completed_at: '2026-08-24T11:43:09.074442+00:00'
last_active_at: '2026-08-24T11:43:09.074681+00:00'
---






# Mission: Fix /admin/settings: deploy to Firebase App Hosting (currently 404 on beta), add missing site chrome (UtilityBar/Header/AdminNav) to match every other admin page, and add a capability-gated nav link in AdminNav.buildLinks(). Root cause: F1's dev/QA chain never opened the page in a real browser.

## Context

(Add context here)

## Notes

