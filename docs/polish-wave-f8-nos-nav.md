# Polish wave F8 - NOS nav consistency

- NV-1: the NOS `/vendors/apply` header dropped "Past shows". The route was prerendered at build
  time, so it froze the nav data as it stood in the build environment while sibling routes
  rendered the live nav.
- Fix: `export const revalidate = 60;` in `app/(nos)/national-show/layout.tsx`. The statically
  rendered pages under that layout now regenerate through ISR at most once a minute, so the
  header links stay identical across NOS routes. The apply page file is untouched and
  `getVisibleNav` remains the single source of the nav.
- Impact (QA verified): static pages under the layout now show a 1 minute ISR window; dynamic
  routes (tickets, conferences, symposium, `vendors/register`) stay dynamic; `archive/[year]`
  stays SSG; NOS `/tickets` sits outside this layout and is unaffected.
- Checks: `contracts/checks/polish-wave-2026-10-25/f8-nav-static.mjs` (layout sets revalidate 60)
  and `f8-nos-nav-consistency.mjs` (nine NOS routes show identical header links after the ISR
  window).
