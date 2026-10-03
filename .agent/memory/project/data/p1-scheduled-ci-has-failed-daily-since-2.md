# p1-scheduled-ci-has-failed-daily-since-2

**[P1] Scheduled CI has failed daily since 2026-09-12 — `/national-show/workshops` and
  `/national-show/conferences` don't return 200 in `e2e/nav-links-200.spec.ts`.** Both routes
  render `CategoryTicketsPage`, which calls `getSoldCountsByTicketType()` (Firebase Admin SDK).
  `.github/workflows/ci.yml:38` deliberately withholds `FIREBASE_ADMIN_*` secrets from the
  e2e job ("because the builder does not get them either"), so these two admin-dependent pages
  500 on every scheduled run. Not a regression — a standing, intentional CI gap that happens to
  match the `menu-system-layout4` M3 gate condition verbatim: "property 1 (no 404 reachable from
  the header) cannot go green until the NOS lane's six routes return 200." Needs a decision
  (inject real secrets into the e2e job vs. a CI-only Firebase Admin mock vs. skip these two specs
  in the scheduled run) before M3 can go green — not something to fix unilaterally since it touches
  CI credentials.
