# Golden — M5 admin information architecture (F14)

Authority for the admin route tree, nav model, dashboard hierarchy, status colour
vocabulary and party-type vocabulary. Where this file and a dispatch brief disagree,
this file wins; where this file and `lib/admin-auth.ts` / `lib/admin-roles.ts`
disagree, **the code wins** — this feature changes no authorization logic.

---

## 1. Route tree

Admin is organised by **audience**, not by data source. Today it is organised by
neither: `/admin` is titled "Ticket Admin" and is a flat `tickets` table, while the
nav calls it "Dashboard".

| Route | Owns | Status |
|---|---|---|
| `/admin` | Overview — "what needs me now". A queue rack, **not** a data table. | CHANGED (table moves out) |
| `/admin/visitors` | Visitor section landing: ticket orders and holders. | NEW |
| `/admin/visitors/tickets` | The table currently rendered at `/admin`, unchanged in behaviour. | MOVED from `/admin` |
| `/admin/vendors` | Vendor section landing: full submissions queue. | EXISTS |
| `/admin/vendors/applications` | Stage-1 short applications queue. | EXISTS |
| `/admin/exhibitors` | Exhibitors — **declared-empty**, see §5. | NEW |
| `/admin/door` | Door scanner. Behaviour, layout and `variant="minimal"` nav unchanged. | EXISTS, UNTOUCHED |
| `/admin/settings` | Payment gateway and operational settings. | EXISTS |
| `/admin/login` | Sign-in. Unchanged. | EXISTS, UNTOUCHED |

**`/admin` must not 404-or-redirect the old table.** `/admin/visitors/tickets` is the
new home; `/admin` keeps a direct link to it in the visitor queue row. No redirect is
added — `/admin` remains a real page with new content.

**`/admin/door` is out of scope for restyling.** Its layout was tuned for one-handed
camera scanning (`app/admin/door/page.tsx`'s own comment; mission
`door-checkin-one-handed`). F16 may add a *ticket-lookup* affordance beside it; it may
not add a persistent nav bar, reduce the video container, or exceed the existing 56px
vertical budget for the minimal trigger — `execution/checks/verify_admin_nav.ts` case 3
already asserts this and must keep passing.

---

## 2. Nav model

Two levels, both presentation-only.

**Level 1 — `components/admin/AdminNav.tsx`, extended, not forked.**
Link set becomes, in this order:

```
Overview · Visitors · Vendors · Exhibitors · Door · Settings
```

Rules carried forward unchanged from `admin-nav-menu` and `admin-nav-active-state`:

- The nav **never derives its own authorization decision.** Every caller resolves
  capabilities server-side and passes them as props. `AdminNav.tsx` must still contain
  no import of `getAdminSession` or `hasCapability`.
- Capability gating stays exactly as it is: `Vendors` on `canReviewVendors`, `Settings`
  on `canManagePaymentSettings`. `Overview`, `Visitors`, `Exhibitors` and `Door` are
  unconditional, because **no route gates on those capabilities today** and hiding a
  reachable link is worse than showing one.
- Active state keeps `aria-current="page"` **plus** `bg-primary-100` **plus**
  `font-semibold` — colour alone is not an indicator (WCAG 1.4.1).
- The mobile trigger keeps its visible "Admin" text label.
- The 1240px collapse breakpoint is unchanged.
- `variant="minimal"` on `/admin/door` is unchanged.

**Level 2 — section sub-nav.** A section with more than one stage (`Vendors`:
Applications / Submissions; `Visitors`: Tickets) renders a sub-nav beneath the bar.
A section with one stage renders none. The sub-nav is a plain `<nav aria-label="…">`
with the same focus-ring token — no new focus vocabulary.

---

## 3. Overview page — information hierarchy

Adapted from pretixSCAN's capability-matrix pattern (research §G): **one row per
queue**, each carrying *count · oldest-pending age · one primary action*. A volunteer
should be able to read the page in five seconds and know what to click.

Top to bottom, exactly:

1. **Show identity line.** Show name, dates, and days-until, from Sanity
   `nationalShow`. Any field Sanity does not supply renders `data-placeholder` — it is
   never invented.
2. **The queue rack.** One row per queue, ordered by **oldest-pending age descending**
   (most-neglected first), not alphabetically and not by code structure:

   | Queue | Source | Primary action |
   |---|---|---|
   | Vendor applications | `vendorApplications` where `status == 'pending'` | Review applications |
   | Vendor submissions | `vendorSubmissions` awaiting review | Review submissions |
   | Vendor payments | `vendorStandOrders` not yet paid | Record payments |
   | Ticket orders | `orders` where `status == 'reserved'` past expiry | Reconcile orders |

   Each row shows: queue name, **pending count as the largest number on the row**,
   oldest-pending age in plain words ("oldest: 6 days"), a status pill from §4, and one
   link. A queue with zero pending renders the row with a `done` pill and the count `0`
   — it is **not** hidden, because a disappearing row destroys the scan pattern.
3. **Sections at a glance.** Visitors / Vendors / Exhibitors, each a card with its
   party badge (§5) and one line saying what it holds.

Explicitly **not** on this page: charts, revenue totals, sparklines, "recent activity".
No audit log exists to source an activity feed from; inventing one would fabricate
history. Revenue reporting is a separate mission.

Every count is fetched server-side via the Admin SDK in the page's own Server
Component, mirroring `app/admin/page.tsx:fetchTickets()`. `export const dynamic =
'force-dynamic'` is required — the same cloud-build prerender trap documented at
`app/admin/vendors/page.tsx:32` applies.

---

## 4. Status colour vocabulary — fixed, four states, defined in words first

Research §G, Pencil & Paper: *"describe the convention in words first, then see if it
still warrants a colour."* Admin gets **exactly four** status meanings. Every status
pill anywhere in `/admin` maps onto one of them. New features pick from this list; they
do not add a fifth.

| State | Means | When |
|---|---|---|
| `pending` | **Needs a human now.** | awaiting review, awaiting payment, expired reservation |
| `active` | In progress, not blocked, nobody's turn yet. | token issued not yet claimed, payment initiated |
| `done` | Settled, positive. | approved, paid, checked in |
| `blocked` | Settled, negative. | declined, refunded, failed |

Constraints:

- **Colour is never the only channel.** Every pill renders a text label. A pill with an
  icon and no text fails.
- **Semantic status colours stay semantic.** A failed payment renders in the error
  colour, never in a brand hue. This is guardrail 1 of the mission's designer ruling and
  it applies to admin with full force.
- **No new hues.** Pills reuse existing SAOC admin tokens. `components/admin/StatusPill.tsx`
  is the single implementation; per-feature ad-hoc pills are a defect.
- Domain status strings (`pending`/`approved`/`declined`/`paid`/`reserved`/…) are
  **mapped** to one of the four; the domain string is what the label shows. The mapping
  is a single exported pure function so it is testable and greppable.

---

## 5. Party vocabulary — answering "vendor? exhibitor? visitor?"

Brad's requirement is that the audience is unmistakable on every screen. That is a
**derived attribute of a record**, not a user account (see D-A2).

`PartyType = 'vendor' | 'exhibitor' | 'visitor' | 'committee'`, rendered by one shared
`components/admin/PartyBadge.tsx`. Same shape, same position, same wording on every
admin surface. A record's party type is derived from which collection it came from —
never stored redundantly, never guessed.

**Exhibitors are declared empty, not fabricated.** There is no exhibitor collection in
Firestore (verified 2026-09-07: the collections are `adminSettings`, `buyers`,
`checkinAttempts`, `contactSubmissions`, `orders`, `supporterRegistrations`, `tickets`,
`vendorApplications`, `vendorStandOrders`, `vendorSubmissions`). Sanity's
`showExhibitorInfo` / `showExhibitorStep` are **editorial guidance content**, not
exhibitor entries.

Therefore `/admin/exhibitors` renders:

- the Exhibitors party badge and section heading;
- one honest sentence stating that exhibitor entries are not yet accepted online and
  that the public guidance lives at `/national-show/exhibitors`;
- a `data-placeholder` marker on the empty region.

It renders **zero rows, zero fake counts, and no "0 of 0" table chrome that implies a
pipeline exists.** Building an exhibitor entry pipeline is a separate mission.

---

## 6. Visual system — admin is deliberately not NOS-branded

Admin keeps the **existing SAOC admin surface** (`parchment` / `ivory` / `rule` / `ink`
/ `primary` tokens, `font-serif` headings, `font-sans` body) plus the four-state status
vocabulary in §4. No NOS token, no NOS font, no NOS emblem enters `/admin`.

Why:

- Admin serves SAOC **year-round and across editions**. NOS 2027 is one edition;
  branding a permanent tool to a dated edition means re-skinning it in 2030.
- The NOS palette is tuned for elegance — pale gold grounds, low-contrast olive
  accents. That is the wrong optimisation for dense operational tables read on a phone
  in a hall. The mission's own contrast note already warns olive on pale gold fails
  WCAG AA.
- The NOS layer is deliberately scoped to
  `app/(marketing)/national-show/layout.tsx`. `/admin` is outside that subtree by
  construction; keeping it that way costs nothing and preserves the "one deletable
  wrapper" property.

What admin *does* get is **information design**: consistent row rhythm, a single number
per row carrying the weight, one primary action per row, and the two fixed vocabularies
above.

---

## 7. Accessibility and responsive floor

- 320px floor. The queue rack stacks; no horizontal page scroll at 320px. Wide tables
  scroll inside their own `overflow-x:auto` container, never the page body.
- Every interactive element: accessible name, visible focus ring (existing
  `FOCUS_RING` token), keyboard operable.
- Tables use real `<th scope>` headers.
- Zero browser console errors on every admin route at 1440 / 375 / 320.

---

## 8. Instrumentation contract — REQUIRED, the A14/A15 checks address these

The two behavioural checks (`execution/checks/verify_admin_ia.ts`,
`execution/checks/verify_admin_status_vocabulary.ts`) address structure through data
attributes rather than by pattern-matching rendered prose. Prose matching would be
brittle, would break on any copy edit, and would silently pass after a redesign. **These
attributes are part of the feature, not debug scaffolding — do not strip them.**

| Attribute | Where | Values |
|---|---|---|
| `data-queue-row` | each queue row on `/admin` | — (presence) |
| `data-queue-id` | same element | `vendor-applications` · `vendor-submissions` · `vendor-payments` · `ticket-orders` |
| `data-queue-count` | the pending-count element inside a row | — (its text must be a bare integer) |
| `data-queue-age` | the oldest-pending-age element inside a row | — (non-empty text) |
| `data-status-state` | every `StatusPill` | `pending` · `active` · `done` · `blocked` |
| `data-party-type` | every `PartyBadge` | `vendor` · `exhibitor` · `visitor` · `committee` |
| `data-placeholder` | `/admin/exhibitors`' empty region | — (presence; already load-bearing project-wide) |

Notes that follow from how the checks are written:

- **`data-queue-id` is asserted as an exact set.** Every one of the four must render, and
  nothing else may. That is what proves a zero-pending queue keeps its row rather than
  being conditionally hidden.
- **The count must be the largest text in its row**, measured by computed `font-size`. A
  utility class is not enough — the check reads the rendered value, so an override fails.
- **Every pill needs visible text.** A pill communicating by colour or icon alone fails
  (WCAG 1.4.1).
- **A11y roles are still required.** `role="row"` must not appear on `/admin/exhibitors`,
  because the check treats any row-shaped element there as a fabricated data row.
- **Seed a `blocked` fixture.** A15 case 5 proves `blocked` renders semantic red and is not
  remapped to a brand hue. With no declined/failed record anywhere in the data, that case
  **fails loudly rather than skipping silently** — a guardrail that cannot run is not a
  guardrail that passed. Ensure a declined vendor application or failed order exists in the
  check environment.

## 9. Non-goals for M5

Stated so a dev does not drift into them:

- No change to `lib/admin-auth.ts`, `lib/admin-roles.ts`, or any capability semantics.
- No writing of custom claims from the UI (privilege-escalation surface; see D-A2).
- No public user accounts.
- No exhibitor data model.
- No revenue/analytics reporting.
- No change to `/admin/door` scanning behaviour.
