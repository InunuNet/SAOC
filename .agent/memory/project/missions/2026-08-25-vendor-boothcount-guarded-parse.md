---
schema: athanor.mission/v1
slug: vendor-boothcount-guarded-parse
goal: 'Fix lib/vendor-register-form-payload.ts:117 -- boothCount is a raw Number.parseInt
  while every other numeric field in this file routes through toOptionalInt(). Garbage
  input parses to NaN then null in the request body -- correct server-side rejection,
  but invisible to the user (no inline feedback). Note the field is type="number",
  so Chromium silently discards non-numeric keystrokes as you type -- "e1" never reaches
  state as a literal, it ends up empty with no inline feedback. Route boothCount through
  the same toOptionalInt() helper as every other numeric field for consistency. Read
  the 4 Codex findings already on file in the backlog before touching this: React
  batches same-event setDescriptor calls so an unmount/remount-dependent banner effect
  never reruns on a second failure; "1.5" and "1e3" coerce to 1 and must not be treated
  as valid; a wiring check must prove the return is conditional on validation failing,
  not merely that some return exists; and a tabindex="-1" check must target the ref-d
  root element, not scan the whole rendered HTML. Verify with real BrowserAgent form
  interaction. Route through @architect for contract + goldens.'
created_at: '2026-08-25T11:04:45.263230+00:00'
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
  title: Route boothCount through toOptionalInt() for parse-path consistency; prove
    no regression in client-side rejection, error display, or focus management
  inline_brief: null
  spec: .agent/memory/project/specs/vendor-boothcount-guarded-parse/contract-f1.yaml
  contract: .agent/memory/project/specs/vendor-boothcount-guarded-parse/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T11:18:56.691469+00:00'
  gate_result: pass
---






# Mission: Fix lib/vendor-register-form-payload.ts:117 -- boothCount is a raw Number.parseInt while every other numeric field in this file routes through toOptionalInt(). Garbage input parses to NaN then null in the request body -- correct server-side rejection, but invisible to the user (no inline feedback). Note the field is type="number", so Chromium silently discards non-numeric keystrokes as you type -- "e1" never reaches state as a literal, it ends up empty with no inline feedback. Route boothCount through the same toOptionalInt() helper as every other numeric field for consistency. Read the 4 Codex findings already on file in the backlog before touching this: React batches same-event setDescriptor calls so an unmount/remount-dependent banner effect never reruns on a second failure; "1.5" and "1e3" coerce to 1 and must not be treated as valid; a wiring check must prove the return is conditional on validation failing, not merely that some return exists; and a tabindex="-1" check must target the ref-d root element, not scan the whole rendered HTML. Verify with real BrowserAgent form interaction. Route through @architect for contract + goldens.

## Context

(Add context here)

## Notes

