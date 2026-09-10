# Golden — the route manifest and the navigation carve-out (M4)

**Supersedes the "Navigation" section of `goldens/m1/route-map.golden.md`**, which named
`components/chrome/nav-config.ts` as one of three acceptable surfaces for inbound links. That
is no longer available to us. The route map is frozen while M1's gate is red; its Navigation
section is queued for correction in the post-gate batch, and until then **this file is
authoritative on navigation.**

## Site chrome is off-limits

These files belong to the SAOC main-site lane, which has a restructure landing on them:

```
components/chrome/nav-config.ts
components/chrome/Header.tsx
components/chrome/MegaMenu.tsx
components/chrome/MobileMenu.tsx
components/chrome/Footer.tsx
```

M4 does not edit them. Two sessions editing `nav-config.ts` concurrently is precisely the
collision the carve-out exists to prevent, and a merge conflict in the site header is not a
cheap thing to discover late. Assertion D39 pins them unmodified — verified clean at
amendment time, so it is a regression guard rather than an aspiration.

**This is a lane boundary, not a technical constraint.** Nothing stops the edit; a ruling
does. If M4 genuinely needs a header change, it goes to the lead orchestrator as a request,
never as a commit.

## Reachability is proved inside `/national-show`

D3's property is unchanged and still matters — **a 200 that nothing links to has not been
delivered**, and this codebase has already paid for that once (`ShowSectionNav.tsx:5-8`:
`/national-show/archive` returned 200 for months with nothing linking to it).

What changes is where the links live. Every route M4 creates must be reachable by clicking
from at least one of **two surfaces we own**:

| surface | why it is ours |
|---|---|
| the `/national-show` hub page's quick links | spec §4.1 requires them regardless: *"Quick-link buttons to About, Book Tickets, Symposium, WOSA Conference, Programme, Workshops, Exhibitors, Sponsors, Plan Your Visit and Contact"* |
| `components/show/ShowSectionNav.tsx` — `SECTION_LINKS` | ours, and it exists precisely because of the archive incident |

**No M4 assertion may depend on a header entry existing.** Beyond the lane boundary, there is
a live open question about whether a header dropdown exists in the approved design at all: the
handoff at `design/design_handoff_saoc/src/chrome.jsx` defines a **flat six-item nav with no
dropdown and no mega menu**, and the repo's `MegaMenu.tsx` predates it. That is Brad's to
settle, not ours — and the safe assumption either way is that **NOS pages reach the user
through the hub, not through a header dropdown.** Designing reachability around a header entry
that may not survive would make our pages unreachable through no fault of ours.

Spec entry 14's link to `/societies` lives on these same two surfaces (D4).

## The route manifest

The main-site lane wires its header from this file without reading our code, so **a manifest
that has drifted from reality is worse than none** — they build from it and never find out.
That is what D40 exists to prevent.

**Path:** `content/national-show-routes.json` — tracked, adjacent to `content/show-pages/`,
and deliberately outside `app/` so it cannot pull M4's contract into a different triad
classification.

```json
{
  "generatedFor": "national-show-ia-alignment M4",
  "routes": [
    {
      "slug": "/national-show/about",
      "label": "About the Show",
      "parent": "/national-show",
      "status": "created",
      "pageKey": "02-about-the-national-show",
      "specNumber": 2
    }
  ]
}
```

`slug`, `label` and `parent` are the contract with the consuming lane — those three are what
was asked for and what their header needs. `status`, `pageKey` and `specNumber` are additive
traceability so the manifest can be cross-checked against the seed corpus rather than
hand-maintained.

**One deliberate widening, stated because it exceeds the request.** The ask was "every page M4
creates". The manifest lists every NOS page that exists *after* M4 — `status: "created"` for
the sixteen new ones, `status: "reconciled"` for the hub and the five existing routes. A
header built from created-only would silently omit `/national-show/what-to-expect`,
`/plan-your-visit`, `/faq`, `/workshops` and `/tickets`, which is the opposite of what the
consuming lane needs. `status` lets them filter if they want only the new ones, so the
widening costs them nothing and the omission would have cost them five pages.

Spec entry 14 appears **only** as a link target, never as a manifest row — it has no page.

## Assertions

| id | check |
|---|---|
| D39 | `components/chrome/` is unmodified against HEAD |
| D40 | the manifest lists **exactly** the routes that exist under `app/(marketing)/national-show/`, no more and no fewer — cross-checked in **both** directions against `page.tsx` files on disk and against `route-map.golden.md`'s CREATE/RECONCILE rows; every row has a non-empty `label`, a `parent` that is `/national-show` (or `null` for the hub), and a `pageKey` resolving to a real seed source |
| D3 (rewritten) | every created route is reachable from the hub's quick links or `ShowSectionNav`'s `SECTION_LINKS` — **`nav-config.ts` is not consulted and must not be** |
| D4 (rewritten) | the `/societies` link is present on one of those two surfaces |

D40's both-directions requirement is the point. A manifest missing a real route silently
drops a page from the other lane's header; a manifest naming a route that does not exist gives
them a dead link they will ship. One-directional checking catches only the first.

## What this does not settle

- **Whether a header dropdown exists at all.** Open with Brad. M4 is designed to be correct
  either way, which is the only thing we can do from here.
- **Whether the other lane actually consumes the manifest correctly.** We assert it is true;
  nothing here asserts they read it. That is a cross-lane integration risk and it belongs to
  the lead orchestrator, not to this contract.
- **Label wording.** The manifest's `label` is what their header will display. We choose it
  from the page title; if the main-site lane wants different labels, that is a conversation,
  not a defect.
