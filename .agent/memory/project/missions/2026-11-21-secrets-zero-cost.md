---
schema: athanor.mission/v1
slug: secrets-zero-cost
goal: 'Cut Secret Manager cost to zero: bundle all App Hosting secrets into at most
  6 active versions, load at server start, delete old secrets and versions'
created_at: '2026-11-21T11:07:39.993321+00:00'
started_at: null
last_active_at: '2026-11-21T20:45:29.951676+00:00'
status: done
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M2
  feature: F4
  ts: '2026-11-21T20:45:18.381344+00:00'
features:
- id: F1
  name: lib/secrets.ts loader + replace direct reads + unit tests
  milestone: M1
  inline_brief: see team-lead brief 2026-11-21 (secrets-zero-cost steps 1-6)
  status: done
  completed_at: '2026-11-21T20:45:15.470033+00:00'
- id: F2
  name: Build SAOC_APP_SECRETS and SAOC_PAYMENT_SECRETS bundles in memory, verify
    by sha256
  milestone: M1
  inline_brief: see team-lead brief 2026-11-21 (secrets-zero-cost steps 1-6)
  status: done
  completed_at: '2026-11-21T20:45:16.837402+00:00'
- id: F3
  name: apphosting.yaml bundle bindings, PR, merge, rollout
  milestone: M2
  inline_brief: see team-lead brief 2026-11-21 (secrets-zero-cost steps 1-6)
  status: done
  completed_at: '2026-11-21T20:45:17.605307+00:00'
- id: F4
  name: Beta verification, delete 19 old secrets, destroy leftovers, docs
  milestone: M2
  inline_brief: see team-lead brief 2026-11-21 (secrets-zero-cost steps 1-6)
  status: done
  completed_at: '2026-11-21T20:45:18.381149+00:00'
milestones:
- id: M1
  name: Loader code and bundles
  features:
  - F1
  - F2
  status: done
  gate_ran_at: '2026-11-21T20:45:29.457319+00:00'
  gate_result: pass
- id: M2
  name: Rollout, verify, cleanup
  features:
  - F3
  - F4
  status: done
  gate_ran_at: '2026-11-21T20:45:29.525350+00:00'
  gate_result: pass
completed_at: '2026-11-21T20:45:29.951449+00:00'
---

# Mission: Cut Secret Manager cost to zero: bundle all App Hosting secrets into at most 6 active versions, load at server start, delete old secrets and versions

## Context

Steps 1-4 done 21 Nov 2026: bundles SAOC_APP_SECRETS (13 keys) and SAOC_PAYMENT_SECRETS (6 keys) created and sha256-verified, PR #225 merged (8d7e0511), rollout-2026-11-21-004 succeeded, beta checks passed. Step 5 (delete the 19 old secrets, list leftovers) handed to the operator: the hook denies gcloud secrets commands. Billing account 012E5F-6BFFAF-44C021 shows only saoc-webapp.

## Notes

21 Nov 2026: Step 5 done. Brad ran the delete loop; all 19 old secrets are deleted, and their versions went with them. `gcloud secrets list` now shows only SAOC_APP_SECRETS and SAOC_PAYMENT_SECRETS, one version each, so 2 of the 6 free. main's apphosting.yaml binds only those two, and beta and nos both return 200. Secret Manager cost: R0/month.

