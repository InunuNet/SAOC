# F3/F4 scope note — why the reachability check is not a full 20-section sweep

`f1-nav-reachability.md` states the multi-angle requirement in general terms ("every
section with `routeStatus: built`"). This contract deliberately does NOT gate on all
15 already-built sections in `f1-coverage-map.json` for two reasons:

1. **Sandbox/concurrency constraint.** `f1-baseline-dirty-files.json` lists
   `components/chrome/Footer.tsx`, `components/chrome/nav-config.ts`,
   `components/chrome/Header.tsx`, `components/chrome/MegaMenu.tsx`, and
   `components/chrome/MobileMenu.tsx` as already dirty from the concurrent
   `ticketing-complete` mission. A full reachability sweep would likely require
   editing exactly those files (adding footer sub-links, restructuring nav) --
   directly conflicting with "F3's checks must tolerate them and @dev must not
   touch them."
2. **Scope discipline.** F3's actual deliverable is one new route
   (`/national-show/about`) plus a content reconciliation
   (`/national-show/what-to-expect`). F4 in this contract is scoped to guarantee
   *those two* pages are not one-nav-item-deep -- the concrete, buildable-now
   slice of the general requirement -- not to retroactively audit
   already-shipped pages (`exhibitors`, `workshops`, `sponsors`, `faq`, etc.)
   built by prior features/missions.

A broader reachability audit of all 15 already-built sections remains open work,
tracked as a follow-on item, not silently declared done by this contract.
