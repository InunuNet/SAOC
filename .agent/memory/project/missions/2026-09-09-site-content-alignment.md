---
schema: athanor.mission/v1
slug: site-content-alignment
goal: 'Align the SAOC site with Lee-Ann''s Drive content inventory: pull the 8 real
  source docs into docs/leeann-source/, build a reproducible page-template system
  and provisional-content banner, ensure all 20 of her sections are covered and reachable
  with sound usability IA (not a literal folder-to-URL mirror), and visibly flag every
  page lacking official committee copy.'
created_at: '2026-09-09T21:20:16.242986+00:00'
started_at: '2026-09-09T21:35:55.338425+00:00'
last_active_at: '2026-09-10T19:28:13.662314+00:00'
status: paused
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: F4
  ts: '2026-09-10T15:46:56.386354+00:00'
features:
- id: F1
  name: Audit, coverage map, unification spec, nav reconciliation spec, question list
    (architect only, no production code)
  milestone: M1
  status: done
  completed_at: '2026-09-09T21:35:53.856451+00:00'
- id: F2
  name: Snapshot the 6 unsnapshotted-but-sourced docs (About/What-to-Expect NOS, Symposium,
    13.1 spec) into docs/leeann-source/; unify the 5 provisional-marker components
    per f1-provisional-unification.md; ship the corrected nav-config.ts comment
  milestone: M2
  status: done
  started_at: '2026-09-09T21:35:55.338270+00:00'
  completed_at: '2026-09-09T22:22:01.398621+00:00'
- id: F3
  name: 'Build the two safe nav/route gaps that need no Lee-Ann answer: National Show
    About (nos-2-about, doc already sourced) route; correct what-to-expect content
    against its snapshot'
  milestone: M2
  status: done
  started_at: '2026-09-09T22:22:02.873539+00:00'
  completed_at: '2026-09-10T15:46:55.133665+00:00'
- id: F4
  name: Multi-angle reachability pass — hub-page and footer cross-links for every
    routeStatus:built section per f1-nav-reachability.md, so no section is one-nav-item-deep
    only
  milestone: M2
  status: done
  completed_at: '2026-09-10T15:46:56.386162+00:00'
- id: F5
  name: Send the 11-item question list to Lee-Ann/Brad (f1-questions-for-leeann.md)
    and gate Symposium/WOSA Conference/International Exhibitors/Programme/Contact
    page builds on real answers, not placeholders invented to unblock the mission
  milestone: M3
  status: blocked-on-leeann
milestones:
- id: M1
  name: Architecture and contract (this session)
  status: in-progress
- id: M2
  name: Buildable-now work — snapshots, component unification, nav correction, safe
    routes, reachability
  status: done
  gate_ran_at: '2026-09-09T21:59:17.944356+00:00'
  gate_result: pass
- id: M3
  name: Lee-Ann-gated work — Symposium, WOSA Conference, International Exhibitors,
    Programme, Show Contact
  status: blocked
---

# Mission: Align the SAOC site with Lee-Ann's Drive content inventory: pull the 8 real source docs into docs/leeann-source/, build a reproducible page-template system and provisional-content banner, ensure all 20 of her sections are covered and reachable with sound usability IA (not a literal folder-to-URL mirror), and visibly flag every page lacking official committee copy.

## Context

Governing decision (Brad, 2026-09-09): Lee-Ann's Drive tree is the content
inventory and coverage contract — which pages must exist, which have official
copy. It is NOT a folder-to-URL map; nav/IA/page-shell are our usability
decisions. The design handoff at `design/design_handoff_saoc/` is approved and
binding — no agent proposes, extends, or reinterprets it (see
`docs/rules/no-invention.md`).

F1 (this session, @architect) produced the audit and every downstream spec —
see `.agent/memory/project/specs/site-content-alignment/contract-f1.yaml` and
its goldens. It wrote NO production code. F2 onward is buildable-now work that
needs no external answer; M3 is explicitly gated behind Lee-Ann/Brad answering
the 11-item question list and must not be started with invented placeholders
in the meantime.

## Notes

- 13 of 20 sections have a working, reachable route today; 5 have a nav entry
  with no route (About, Symposium, WOSA Conference, Programme, International
  Exhibitors); 2 are content-blocked on Lee-Ann (Contact, FAQ) independent of
  route state. See `f1-coverage-map.json` for the authoritative, per-section
  breakdown (`contentStatus` × `routeStatus`).
- The five numbering gaps (8, 9, 10, 14, 16) and the unnumbered top-level spec
  doc are recorded explicitly, not silently absorbed — open questions 2 and 11.

