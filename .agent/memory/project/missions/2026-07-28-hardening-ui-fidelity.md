---
schema: athanor.mission/v1
slug: hardening-ui-fidelity
goal: 'Phase 1 hardening + home-page design fidelity sprint: clear the four small
  unblocked hygiene/security items (dotenv supply-chain check, Sanity Free-plan limits
  assessment, CLAUDE.md tech-stack correction, harness test-failure triage), then
  run the full home-page UI drift audit against the Claude Design reference and fix
  all confirmed deviations in one contract-gated pass'
created_at: '2026-07-28T18:11:08.912585+00:00'
started_at: '2026-07-28T19:08:48.120579+00:00'
last_active_at: '2026-07-28T19:18:10.388796+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F3
  ts: '2026-07-28T19:18:10.388796+00:00'
features:
- id: F1
  title: dotenv supply-chain sanity check
  status: done
  inline_brief: 'P1 security item (backlog, noticed 2026-07-24): the pinned dotenv@17.4.2
    prints a promotional banner referencing www.vestauth.com on load. Verify via Alembic
    (never direct fetch) against the upstream dotenv repo/npm changelog that this
    is upstream''s own known behaviour, not a compromised/typosquatted package or
    malicious postinstall: diff the installed package (node_modules/dotenv) against
    the published npm tarball checksum, check for postinstall scripts, check advisory
    databases. Then suppress the banner (dotenv supports a quiet flag) or pin/replace
    as warranted. Small contract: assertions for no banner in dev/build output + package
    integrity verified. Outcome recorded in backlog + docs if anything found.

    '
  started_at: '2026-07-28T19:08:48.120440+00:00'
  completed_at: '2026-07-28T19:18:10.201076+00:00'
- id: F2
  title: Sanity Free-plan limits assessment
  status: done
  inline_brief: 'Backlog item: the Sanity project auto-downgraded to Free when the
    Growth trial ended (2026-07-14). Dataset read/write already confirmed working.
    Assess remaining Free-plan limits (API CDN request quota, dataset size, seats,
    API token count) against actual current usage via the Sanity management/usage
    API with the project token, and confirm the SANITY_API_TOKEN GROQ cron (.github/workflows/refresh-llms.yml)
    fits Free-tier quotas. Deliverable: short findings note in docs/ or backlog with
    any limit within 2x of current usage flagged. Research/assessment feature — no
    code change expected; if a limit is already breached, log it as a new backlog
    item rather than fixing inline.

    '
  started_at: '2026-07-28T19:12:31.717998+00:00'
  completed_at: '2026-07-28T19:15:42.487010+00:00'
- id: F3
  title: CLAUDE.md tech-stack table correction
  status: done
  inline_brief: 'Docs-accuracy backlog item: CLAUDE.md''s tech-stack table omits Sanity
    entirely (stale — already caused a wrong "scope creep" flag Brad had to correct).
    Update the table to include Sanity CMS (content editing; Studio at /studio) alongside
    Firestore (tickets/events/contact), and sanity-check the rest of the table row-by-row
    against package.json and the repo while in there (e.g. Auth row, Forms row). Trivial
    edit + review; contract can be a simple grep assertion set.

    '
  started_at: '2026-07-28T19:12:31.525217+00:00'
  completed_at: '2026-07-28T19:18:10.388648+00:00'
- id: F4
  title: Harness test-failure triage on clean template
  status: done
  inline_brief: 'Backlog [athanor-upstream] item: execution/tests/test_contract_fix.py
    (10/15) and execution/tests/test_mission.py (17/19) fail identically on 3.7.107
    and 3.7.109 in this project. Clone/copy a CLEAN Athanor template checkout into
    a scratch dir, run both test files there, and determine upstream-bug vs self-inflicted
    (this repo''s execution/contract.py and mission.py carry local modifications).
    If clean template reproduces: file a gh issue on InunuNet/Athanor with the failing
    test names + output. If not: identify which local modification broke the tests
    and fix it here (surgical, via contract). Either way record the verdict in the
    backlog item.

    '
  started_at: '2026-07-28T19:14:13.730980+00:00'
  completed_at: '2026-07-28T19:15:42.692992+00:00'
- id: F5
  title: Home-page UI drift audit vs Claude Design reference
  status: pending
  inline_brief: 'Audit-only feature (no fixes here). Compare every home-page section
    of local dev against design/Claude Design HTML/SAOC%20Website%20(standalone).html
    per the backlog item: open both, screenshot section-by-section (headless browser),
    and produce a complete deviation list with severity + file/component per deviation.
    Known starting points from 2026-06-30: ShowBand/flagship section regressed locally;
    EventsStrip hostSociety field may be unpopulated in Firestore docs (verify data,
    not just code); YearbookStrip image difference is prod-only image optimisation
    (no code change); Footer sprawl is viewport perception (no code change). Re-verify
    each of those claims rather than trusting them. Deliverable: audit doc that @architect
    turns into the F6 contract + goldens. Note: the 2026-07-28 chrome move to app/(marketing)/layout.tsx
    changed layout plumbing — include a check that home chrome still matches the reference.

    '
- id: F6
  title: Implement home-page fidelity fixes from audit
  status: pending
  inline_brief: 'Implement ALL confirmed code deviations from the F5 audit in one
    contract-gated pass (per backlog: no ad-hoc section fixes). @architect writes
    the contract + goldens from the audit doc (screenshot-diff or DOM/class assertions
    per section, plus pnpm build + type-check green); @dev implements; adversarial
    @qa verifies against the design reference directly, not against @dev''s claims.
    Data-side findings (e.g. missing hostSociety references in Firestore events docs)
    are fixed as data corrections and asserted via a read-back check. If F5 finds
    zero real code deviations, this feature closes trivially with the audit doc as
    evidence.

    '
milestones:
- id: M1
  title: Hardening — security, limits, docs accuracy, harness triage
  features:
  - F1
  - F2
  - F3
  - F4
  status: done
  gate_ran_at: '2026-07-28T19:18:15.174520+00:00'
  gate_result: pass
- id: M2
  title: Home-page design fidelity — audit then fix
  features:
  - F5
  - F6
  status: pending
---










# Mission: Phase 1 hardening + home-page design fidelity sprint

## Context

Planned 2026-07-28 with Brad, immediately after the sanity-studio-p0 fix chain landed
(commit d2c9a2c) and the template update to 3.7.109. This mission bundles everything
that is currently UNBLOCKED; all larger Phase-1 work is waiting on external inputs:

- PayFast M2 (mission 2026-07-01-payfast-ticketing, PAUSED): blocked on society-supplied
  sandbox credentials + 2027 ticket pricing. Resume THAT mission (mission.py activate)
  the moment Brad supplies them — it outranks this one if both are live; pause this one
  at a feature boundary if needed.
- Sanity Studio P0 remainder is HUMAN-side (Brad: `pnpm exec sanity login` for membership
  verification; CORS origins for http://localhost:3002 and
  https://saoc-prod--saoc-webapp.europe-west4.hosted.app at manage.sanity.io/projects/26yfbug4).
  Not in this mission. If Brad completes them mid-mission, verify Studio editing works
  end-to-end and close the P0 backlog item.
- Scope-freeze still in force: no Section 7 schemas, no un-built National Show pages
  (Spec V2 reconciliation unsent). WOSA is out of scope permanently (separate developer).
- Standing rule: use the harness as designed; file every harness bug/friction upstream
  via gh on InunuNet/Athanor (see 1314/1315/1316 filed 2026-07-28).

Sequencing: M1 features are independent and small — run them F1→F4 (F1 first: security).
M2 is strictly audit-before-fix: F5 produces the deviation list, F6 fixes it in one pass.

## Notes

- Design reference lives at `design/Claude Design HTML/` (untracked). Do not commit it
  as part of this mission without Brad's say-so.
- `pnpm lint` is known-broken repo-wide (untracked legacy backup dir not excluded in
  eslint.config.mjs) — do not gate on it; fixing that is fair game as a bonus find in
  F3's row-by-row review ONLY if trivial, otherwise new backlog item.
- Agent-spawn note: @docs (and possibly other roles) hit the unresolved
  $ANTHROPIC_DEFAULT_HAIKU_MODEL model id (Athanor #1314) — spawn with an explicit
  model override until fixed upstream.
