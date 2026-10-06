---
schema: athanor.mission/v1
slug: beta-password-wall
goal: 'Put a password wall in front of beta.saoc.co.za so search engines and the public
  cannot find or browse it by accident (Brad, 2026-10-06, after a meeting with Lee-Ann).
  HTTP Basic auth enforced in Next.js 16 proxy.ts for every page and asset, HOST-AGNOSTIC
  (applies on every host this backend answers on, including the real saoc.co.za apex
  — team-lead ruling 2026-10-06: no host-based auto-lift, since the DNS/Resend migration
  can land before the council decides to launch publicly), credential read from an
  App Hosting secret (Secret Manager, never in source), fail-closed if the secret
  is missing in production. Also send X-Robots-Tag: noindex, nofollow and serve a
  disallow-all robots.txt, on every host, until an explicit SITE_PUBLIC_LAUNCH=true
  RUNTIME env var (plain, not a secret, absent by default) lifts the wall, the noindex
  header, and the robots disallow-all all together, as one deliberate launch action.
  Exempt ONLY machine-to-machine endpoints that cannot authenticate: PayFast/Ozow
  ITN notification routes, the Sanity revalidate webhook, and the Cloud Scheduler
  reconcile-orders route (each already has its own signature/secret verification)
  — this exemption is unconditional, even once publicly launched. Local dev and Playwright
  e2e must keep working (bypass when the secret env var is unset outside production,
  or credentials supplied by the test harness). Verify on the deployed beta: unauthenticated
  request -> 401 with WWW-Authenticate, authenticated -> 200, exempt webhook paths
  not 401.'
created_at: '2026-10-06T17:53:27.838136+00:00'
started_at: '2026-10-06T18:20:38.906297+00:00'
last_active_at: '2026-10-06T19:28:31.254572+00:00'
status: done
cost_estimate:
  features: 2
  milestones: 1
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-10-06T19:07:53.703746+00:00'
features:
- id: F1
  inline_brief: null
  name: proxy.ts Basic Auth wall (Next 16 canonical filename, exports named `proxy`
    — see docs/beta-password-wall.md for why not the deprecated `middleware.ts` alias)
    covering every request to this backend, HOST-AGNOSTIC (applies identically on
    beta.saoc.co.za, any *.hosted.app preview origin, and the real saoc.co.za apex
    alike — a first draft that auto-lifted the wall once DNS migrated the apex onto
    this backend was rejected by the team lead 2026-10-06, since that migration can
    land before the council decides to launch publicly); edge-safe constant-time credential
    compare (SHA-256 digest + fixed-length XOR, no node:crypto.timingSafeEqual on
    the Edge runtime); exact-match exemption for the 6 machine-to-machine webhook
    routes; new lib/beta-public-launch.ts isPubliclyLaunched() — the ONE explicit
    switch (a new SITE_PUBLIC_LAUNCH RUNTIME env var, exact-match against the literal
    string 'true', absent from apphosting.yaml until the council actually decides
    to launch) shared by proxy.ts and the updated app/robots.ts, so the wall, the
    noindex header, and the disallow-all robots.txt can only ever lift together, by
    that one deliberate action, never as a side effect of a DNS/Resend migration;
    golden Playwright spec e2e/beta-password-wall-decision.spec.ts (written directly
    by @architect) proving the pure decision function, not left to @dev's interpretation.
  milestone: M1
  status: in_progress
  spec: .agent/memory/project/specs/beta-password-wall/contract-f1.yaml
  contract: .agent/memory/project/specs/beta-password-wall/contract-f1.yaml
  started_at: '2026-10-06T18:20:38.906138+00:00'
- id: F2
  inline_brief: null
  name: Deploy-time secret plumbing (apphosting.yaml BETA_BASIC_AUTH_USER/ BETA_BASIC_AUTH_PASSWORD
    as RUNTIME-only Secret Manager entries, generated randomly and never printed —
    an orchestrator ops step, not code @dev writes) plus test-harness credential updates
    for the two existing project-owned live-browser check scripts that hit https://beta.saoc.co.za
    (contracts/checks/door-checkin-one-handed-f1/check-live-viewport.mjs, contracts/checks/admin-settings-deploy-and-chrome-fix-f1/check-live-chrome.mjs
    — add Playwright httpCredentials only when both env vars are set, otherwise unchanged);
    deployed verification that unauthenticated -> 401 + WWW-Authenticate, authenticated
    -> 200, and the 6 exempt webhook paths never carry a WWW-Authenticate header.
    Flags (does not patch — execution/ is HARNESS-owned) that the harness's own execution/browser_deployed_check.sh
    independent live re-check has no Basic Auth passthrough and will start failing
    its curl re-check leg project-wide the moment this ships; recorded in backlog.md
    for upstream filing.
  milestone: M1
  status: in_progress
  spec: .agent/memory/project/specs/beta-password-wall/contract-f2.yaml
  contract: .agent/memory/project/specs/beta-password-wall/contract-f2.yaml
  started_at: '2026-10-06T18:28:24.375837+00:00'
milestones:
- id: M1
  features:
  - F1
  - F2
  name: Password wall live on beta.saoc.co.za — proxy.ts + robots/noindex (F1), secret
    plumbing + harness credential updates + deployed verification (F2)
  status: done
  gate_ran_at: '2026-10-06T19:28:07.779090+00:00'
  gate_result: pass
completed_at: '2026-10-06T19:28:31.254349+00:00'
---

# Mission: Put a password wall in front of beta.saoc.co.za so search engines and the public cannot find or browse it by accident (Brad, 2026-10-06, after a meeting with Lee-Ann). HTTP Basic auth enforced in Next.js 16 middleware/proxy for every page and asset, credential read from an App Hosting secret (Secret Manager, never in source), fail-closed if the secret is missing in production. Also send X-Robots-Tag: noindex, nofollow and serve a disallow-all robots.txt on the beta host. Exempt ONLY machine-to-machine endpoints that cannot authenticate: PayFast/Ozow ITN notification routes, the Sanity revalidate webhook, and the Cloud Scheduler reconcile-orders route (each already has its own signature/secret verification). Local dev and Playwright e2e must keep working (bypass when the secret env var is unset outside production, or credentials supplied by the test harness). Verify on the deployed beta: unauthenticated request -> 401 with WWW-Authenticate, authenticated -> 200, exempt webhook paths not 401.

## Context

(Add context here)

## Notes


- 2026-10-06 — F1 retry 1 (@architect): deployed QA found a CRITICAL Cloud CDN replay
  (an anonymous request got the cached authenticated homepage, `cdn-cache-status: hit`).
  Fix: while walled, proxy.ts sets `Cache-Control: private, no-store, max-age=0` plus a
  `saoc_beta_wall=1` Set-Cookie marker on every response. The marker covers the image
  optimizer and /og, which overwrite Cache-Control. Proven against local `next start`:
  contracts/checks/beta-password-wall/check-cache-headers.mjs (F1 A9/A10). Deployed
  authenticated-then-anonymous pair proof: check-deployed-cdn-pairs.mjs (F2 A12/A13).
  Separate finding, not fixed: local-src next/image returns 400 behind the wall.
