---
schema: athanor.mission/v1
slug: drive-photo-rename
goal: Rename the 125 unnamed photos in Lee-Ann's shared Drive (Photos Supplied/Hedrik
  Schoeman, Previous Shows/2006 - Nat Show) by identifying the orchid in each (Brad
  2026-11-09). Read-only identification on local copies first; proposed rename table
  goes to Brad; Drive renames only after his approval, with a rollback map.
created_at: '2026-11-09T13:17:29.759289+00:00'
started_at: '2026-11-09T13:20:09.365080+00:00'
last_active_at: '2026-11-09T13:28:23.780273+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F3
  ts: '2026-11-09T13:28:23.780273+00:00'
features:
- id: F1
  inline_brief: .agent/memory/project/specs/drive-photo-rename/brief.md
  name: Identify and propose names for the 82 photos in Photos Supplied / Hedrik Schoeman
    (local copies, read-only)
  milestone: M1
  status: in_progress
  no_contract_reason: data-labelling task on local photo copies; no code; inline brief
  started_at: '2026-11-09T13:20:09.364876+00:00'
- id: F2
  inline_brief: .agent/memory/project/specs/drive-photo-rename/brief.md
  name: Identify and propose names for the 43 photos in Previous Shows / 2006 - Nat
    Show (local copies, read-only)
  milestone: M1
  status: done
  no_contract_reason: data-labelling task on local photo copies; no code; inline brief
  started_at: '2026-11-09T13:20:10.791564+00:00'
  completed_at: '2026-11-09T13:22:47.534878+00:00'
- id: F3
  inline_brief: .agent/memory/project/specs/drive-photo-rename/brief.md
  name: Upload renamed copies plus the rename map to a NEW Drive folder; originals
    untouched; Lee-Ann asked to have someone check
  milestone: M2
  status: done
  no_contract_reason: Drive upload of renamed copies to a new folder; Brad-authorised
    2026-11-09
  started_at: '2026-11-09T13:23:49.514070+00:00'
  completed_at: '2026-11-09T13:28:23.780080+00:00'
milestones:
- id: M1
  features:
  - F1
  - F2
  name: Proposed names for all 125 photos
  status: pending
- id: M2
  features:
  - F3
  name: Renamed copy in Drive for SAOC to check
  status: pending
force_orphaned_at: '2026-11-09T13:56:02.739650+00:00'
---

# Mission: Rename the 125 unnamed photos in Lee-Ann's shared Drive (Photos Supplied/Hedrik Schoeman, Previous Shows/2006 - Nat Show) by identifying the orchid in each (Brad 2026-11-09). Read-only identification on local copies first; proposed rename table goes to Brad; Drive renames only after his approval, with a rollback map.

## Context

Brief, scope, naming rules and Brad's words: .agent/memory/project/specs/drive-photo-rename/brief.md. Originals are never touched; F3 writes only a new folder of copies (Brad 2026-11-09). QA is human: a checker Lee-Ann nominates reviews every name.

## Notes

