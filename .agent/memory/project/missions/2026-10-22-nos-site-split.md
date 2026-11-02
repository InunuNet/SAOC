---
schema: athanor.mission/v1
slug: nos-site-split
goal: 'Split the National Orchid Show into its own site at nos.saoc.co.za (Brad 2026-10-23):
  one Next.js app + one App Hosting backend, host-based front ends with separate header/footer/menus;
  all /national-show pages, tickets, checkout, vendors move to nos; SAOC keeps no
  show pages but cross-links; admin neutral and reachable on every host; password
  wall + noindex + sandbox on nos; per-site sponsors and media kit (media kit behind
  login); newsletter lets subscriber choose SAOC and/or NOS.'
created_at: '2026-10-22T22:41:37.176590+00:00'
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
features:
- id: F1
  inline_brief: null
  name: Host module, proxy routing and redirects, route-group moves, layouts, robots,
    sitemap
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/nos-site-split/contract.yaml
  contract: .agent/memory/project/specs/nos-site-split/contract.yaml
  started_at: null
  completed_at: null
- id: F2
  inline_brief: null
  name: Absolute URLs for email, payment and vendor links on the NOS host; apphosting
    env
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/nos-site-split/contract.yaml
  contract: .agent/memory/project/specs/nos-site-split/contract.yaml
  started_at: null
  completed_at: null
- id: F3
  inline_brief: null
  name: Per-site menus and footers, cross-links, SAOC credit on NOS, e2e path updates
  milestone: M1
  status: pending
  spec: .agent/memory/project/specs/nos-site-split/contract.yaml
  contract: .agent/memory/project/specs/nos-site-split/contract.yaml
  started_at: null
  completed_at: null
- id: F4
  inline_brief: null
  name: Per-site sponsors verification and media kit behind login gate
  milestone: M2
  status: pending
  spec: .agent/memory/project/specs/nos-site-split/contract.yaml
  contract: .agent/memory/project/specs/nos-site-split/contract.yaml
  started_at: null
  completed_at: null
- id: F5
  inline_brief: null
  name: Newsletter topic choice SAOC and or NOS
  milestone: M2
  status: pending
  spec: .agent/memory/project/specs/nos-site-split/contract.yaml
  contract: .agent/memory/project/specs/nos-site-split/contract.yaml
  started_at: null
  completed_at: null
milestones:
- id: M1
  features:
  - F1
  - F2
  - F3
  name: Host-split core
  status: pending
- id: M2
  features:
  - F4
  - F5
  name: Per-site content and newsletter
  status: pending
force_orphaned_at: '2026-11-01T08:55:46.620245+00:00'
---

# Mission: Split the National Orchid Show into its own site at nos.saoc.co.za (Brad 2026-10-23): one Next.js app + one App Hosting backend, host-based front ends with separate header/footer/menus; all /national-show pages, tickets, checkout, vendors move to nos; SAOC keeps no show pages but cross-links; admin neutral and reachable on every host; password wall + noindex + sandbox on nos; per-site sponsors and media kit (media kit behind login); newsletter lets subscriber choose SAOC and/or NOS.

## Context

(Add context here)

## Notes

