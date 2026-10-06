# p1-sibling-checker-has-the-identical-sta

**[P1] Sibling checker has the identical stale-`ctaHref` bug F9 just fixed, currently
  dormant — will silently under-measure the real gate property once NOS routes land.**
  `contracts/checks/menu-system-layout4-shared/check-nav-links-200-gated-by-exemptions.mjs:147`
  still does `if (item.featureRail) hrefs.push(item.featureRail.ctaHref);` — the F7 shape F8
  replaced with `featureRail.destinations[]` (see F9,
  `.agent/memory/project/specs/menu-system-layout4/contract-f9.yaml`, which fixed the same bug
  in `check-nav-hrefs-golden.mjs` but was scoped only to that file). Currently masked because
  `f1-pending-nos-routes.json` still lists 6 pending routes, so this checker exits 3 (SKIP)
  instead of running its real HTTP-200 property check. The moment that pending list empties
  (NOS lane lands — this is exactly mission `menu-system-layout4` M3's own blocking condition,
  see the CI backlog item below), this checker will push a literal `undefined` into its href
  list instead of the two feature-rail secondary destinations, silently under-measuring
  "property 1: no 404 reachable from the header" — the exact defect class this file's own
  header comment says it exists to prevent. Found by @qa during F9 review (2026-09-14). Fix:
  same pattern as F9 — loop over `featureRail.destinations` collecting `.href`. Should land
  before the NOS pending list empties, not after.
