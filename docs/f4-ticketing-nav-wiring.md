# F4: Ticketing Navigation Wiring for Conferences and Workshops

**Feature:** F4 of mission `ticketing-conferences-and-events` (milestone M2). Extends the National Show mega-menu's Tickets column to include direct-link entries for the two new categories — Conferences and Workshops & Field Trips — previously deferred until the category-aware purchase pages existed.

**Contract:** `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f4-nav-wiring.yaml` — the full design record; read first. **This doc is the guide; that is the specification.**

**Status:** Gated ✓, QA-passed, Codex cross-model-passed.

---

## Why This Feature Exists

Mission M2-F3 (done, commit `fae3507`) built the category-aware purchase pages for Conferences and Workshops & Field Trips at `/national-show/conferences` and `/national-show/workshops`, unblocking this feature.

Before F3, those routes didn't exist, so there was nowhere to link. The contract recorded this deferral in `contracts/golden/ticketing-nav-f3/README.md` (labelled "F3" under the mission's original feature numbering, before mid-mission restructure). F1–F2 of this mission prepared the Navigation structure with a data-driven config — `components/chrome/nav-config.ts` — specifically to make adding these two new entries require **only a data append**, no component rewrites.

**With F3 complete,** the premise of the deferral is resolved: both destination pages now exist and are live.

---

## What Shipped: Pure Data Append

### One File Changed: `components/chrome/nav-config.ts`

The Tickets column's `links` array now has exactly five entries (up from three):

```ts
links: [
  { id: 'visitor', label: 'Visitor Tickets', href: '/tickets' },
  { id: 'exhibitor', label: 'Exhibitor Entry', href: '/national-show/exhibitors' },
  { id: 'vendor', label: 'Vendor Registration', href: '/national-show/vendors/register' },
  { id: 'conferences', label: 'Conferences', href: '/national-show/conferences' },      // New (F4)
  { id: 'workshops', label: 'Workshops & Field Trips', href: '/national-show/workshops' }, // New (F4)
],
```

**No component changes.** The three existing entries (Visitor, Exhibitor, Vendor) are unchanged. The two new entries are appended after them. `Header.tsx`, `MegaMenu.tsx`, and `MobileMenu.tsx` all consume this data array via iteration (established in M1-F1, `ticketing-nav-restructure`) — they render whatever the array contains without hardcoding anything. This is extensibility by design: when the mission needed to add new categories, there was no component code to touch, only data to extend.

---

## Naming: "Workshops & Field Trips," Never "Events"

The "Workshops & Field Trips" label is used verbatim — never shortened to bare "Events." This naming rule was established in Mission M1, feature F2 (`ticketing-nav-restructure`) and is preserved here:

- The site already has a top-level "Events" nav item pointing to `/events` (the societies calendar).
- The National Show's workshop/field-trip category is a different offering entirely.
- Reusing "Events" as a label in the Tickets column would collide with the existing nav item.

`verify_no_bare_events_label.py` (from F2) checks this invariant across the nav-wired files; it continues to pass.

---

## What Would Invalidate This Feature

- Either destination route (`/national-show/conferences` or `/national-show/workshops`) is removed or renamed — the nav links would then point at 404 pages. A1 of the contract checks that both exist.
- A structural change is made to `Header.tsx`, `MegaMenu.tsx`, or `MobileMenu.tsx` to accommodate this feature — this would violate the "data-driven extensibility" principle. A6 checks that these files are untouched.
- The Workshops entry's label is shortened to bare "Events," recreating the naming collision. A7 checks for this.
- The list has fewer or more than five entries, or the first three are reordered or removed. A4 and A5 guard this.

---

## Known Gap: Older Browser-Automation Checks Need Update

`execution/checks/verify_nav_mega_menu.ts` (from M1-F1) is a Playwright browser test that verifies desktop and mobile nav behavior—open/close, keyboard focus, Tab handling, etc. It currently asserts only the three pre-F4 hrefs exist (visitor, exhibitor, vendor) and does not yet check the two new entries (conferences, workshops).

**This is non-blocking:** The check still passes—it just has stale coverage. A future QA pass could extend it to assert the new hrefs, but it is not required for this feature's gate closure. The contract's shell assertions (A2, A3) verify the entries exist; the older Playwright test is just a bonus UX harness, now with reduced scope.

---

## Files Changed

**Modified:**
- `components/chrome/nav-config.ts` — two entries appended to the Tickets column's `links` array

**Unchanged:**
- `components/chrome/Header.tsx`
- `components/chrome/MegaMenu.tsx`
- `components/chrome/MobileMenu.tsx`
- `app/(marketing)/national-show/conferences/page.tsx` (from F3, untouched)
- `app/(marketing)/national-show/workshops/page.tsx` (from F3, untouched)
- All API routes and checkout logic (already category-agnostic)

---

## Sources

- `.agent/memory/project/specs/ticketing-conferences-and-events/contract-f4-nav-wiring.yaml` — live contract, assertions A1–A8
- `.agent/memory/project/specs/ticketing-conferences-and-events/goldens/f4-nav-wiring.golden.md` — expected state and structure
- `docs/f3-ticketing-purchase-pages.md` — the routes F4 now wires to
- `docs/f1-ticketing-nav-restructure.md` — foundation: data-driven nav, why this extensibility pattern exists
- `contracts/golden/ticketing-nav-f3/README.md` — historical: the deferral decision, now superseded by this feature's completion
