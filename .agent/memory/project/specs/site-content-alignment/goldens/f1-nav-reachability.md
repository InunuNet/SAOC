# F1 — Nav reconciliation and multi-angle reachability spec

## nav-config.ts comment correction

`components/chrome/nav-config.ts:10-16` currently reads (in part):

> "...her Drive folder's numbering is document order, not information architecture,
> so this file does not mirror it; it only guarantees every one of those six
> destinations stays reachable..."

This is **superseded**. It was written when only the 6 SAOC sections were being
reconciled against nav; this mission (site-content-alignment) extends the same
reachability guarantee to all 20 of her sections, National Show included, and
introduces `f1-coverage-map.json` as the authoritative coverage record the nav
must reconcile against — not just a same-file comment. F2 must replace the
comment with text that:

1. Keeps the true, still-valid point: Drive folder numbering is document order,
   not IA — nav does not mirror it.
2. Points at `.agent/memory/project/specs/site-content-alignment/goldens/fixtures/f1-coverage-map.json`
   as the section-to-route source of truth, superseding the "six destinations"
   framing (now twenty).
3. Cross-references `f6-pending-nos-routes.json`
   (`.agent/memory/project/specs/ticketing-complete/goldens/fixtures/`) for the
   still-open route-gap list, rather than restating it inline (avoids the two
   files drifting apart).

## Cross-reference requirement: f1-coverage-map.json vs f6-pending-nos-routes.json

Every href in `f6-pending-nos-routes.json`'s `pendingRoutes` array
(`/national-show/about`, `/national-show/exhibitors/international`,
`/national-show/symposium`, `/national-show/wosa-conference`,
`/national-show/programme`) must equal exactly one `routes[]` entry on a section
in `f1-coverage-map.json` whose `routeStatus` is `gap-nav-only` — and every
`f1-coverage-map.json` section with `routeStatus: gap-nav-only` whose route is
already wired into `nav-config.ts` must appear in `f6-pending-nos-routes.json`.
Neither file may drift from the other; a route that lands for real must be
removed from `f6-pending-nos-routes.json` in the same change that flips its
`f1-coverage-map.json` `routeStatus` to `built`.

## Multi-angle reachability

Per the mission goal ("ensure all 20 of her sections are covered and reachable
with sound usability IA... visibly flag every page lacking official committee
copy"), every section with a real route (`routeStatus: built`) must be reachable
from more than one of: primary nav (`nav-config.ts`), a relevant hub page (e.g.
`/national-show` linking to its own sub-sections), the footer, or an explicit
cross-link from a related section's page. A section reachable ONLY via a single
deep nav item, with no hub-page or footer corroboration, is a usability gap F2
should close — this spec does not prescribe which secondary path each section
gets (that is implementation judgement within the existing handoff patterns), but
requires at least one exists.

## `/media-kit` and legal pages — not part of this reconciliation

`/constitution`, `/privacy`, `/terms`, `/refunds` are legitimately ours
(governance/legal boilerplate, not content-coverage items) and are out of scope
for the 20-section reachability requirement. `/media-kit` is genuinely orphaned —
not one of Lee-Ann's 20 named sections — and is Open Question 9 below (keep as a
value-add, or fold into Sponsors/About) rather than something F2 should silently
keep or remove.
