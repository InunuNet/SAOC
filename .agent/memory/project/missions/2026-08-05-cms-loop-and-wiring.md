---
schema: athanor.mission/v1
slug: cms-loop-and-wiring
goal: Close the CMS loop so a published Studio edit actually reaches the live site,
  then wire the pages and document types the client can edit to no effect — the CDN
  purge on revalidate, the /events/[slug] cache tags, the /national-show singleton,
  and the orphaned award/province types
created_at: '2026-08-05T19:30:00.000000+00:00'
status: in_progress
autonomy: high
supersedes_blocker: cms-activation-deploy F6
cost_estimate:
  features: 4
  milestones: 3
  total_calls: 0
features:
- id: F1
  name: Purge the CDN on revalidate (closes cms-activation-deploy F6)
  status: in_progress
  inline_brief: Root cause is diagnosed and verified verbatim against nextjs.org/docs/app/guides/cdn-caching
    — revalidateTag() invalidates only the Next.js server cache; the CDN keeps serving
    its copy until s-maxage expires unless a CDN purge is triggered alongside it.
    app/api/revalidate/route.ts calls revalidateTag and stops. Read docs/f6-cdn-invalidation-investigation.md
    FIRST — do not re-derive it. Investigate whether App Hosting exposes a purge API;
    the deployed host returns cache-tag headers that look built for it. A shorter
    s-maxage is a legitimate fallback if no purge API exists — state the trade-off,
    do not silently choose it. Done when contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs
    (A1) flips FAIL to PASS without weakening the check or lengthening its 120s bound,
    and the full contracts/f6-prove-cms-loop.yaml gate is green.
  started_at: '2026-08-05T21:36:32.069785+00:00'
- id: F2
  name: Fix /events/[slug] revalidation tags
  status: pending
  inline_brief: app/(marketing)/events/[slug]/page.tsx tags its sanityFetch calls
    ['events'] — no 'sanity' tag, and 'events' matches neither the real document _type
    (societyEvent) that a webhook sends. So event pages will not revalidate even once
    F1 lands. Independent of F1; do not conflate them in one assertion. Done when
    a published edit to a societyEvent reaches its live /events/<slug> page, asserted
    the same way A1 asserts /about.
- id: F3
  name: Wire /national-show to its seeded singleton
  status: pending
  inline_brief: app/(marketing)/national-show/page.tsx fetches only showClassesQuery
    and pastShowsQuery. Title, dates, venue, host, hero image and exhibitor stages
    are literal JSX, so the seeded nationalShow singleton is inert — the client edits
    it and nothing happens. nationalShowQuery already projects the needed fields (sanity/queries.ts:30-39).
    Note the one field that DOES work - nationalShow.countdownDate drives the HOME
    page countdown via ShowBand; the /national-show page's own countdown is a hardcoded
    constant in components/show/ShowCountdown.tsx:5 — wire that too. Caution - this
    page is heavily hardcoded and intersects the pending Claude Design handoff. Wire
    data flow only; invent no visual design and restructure no layout. Done when editing
    title/venue/hero in the Studio changes the deployed page, proven by a round trip
    like F6's, not by asserting the query exists. Then update docs/secretary-cms-guide.md
    section 7 and the top "What You Can and Cannot Change Yourself" section, which
    currently tell her this page is not editable.
- id: F4
  name: Resolve the orphaned document types (award, province)
  status: pending
  inline_brief: award and province appear in the Studio sidebar (sanity/structure.ts
    COLLECTION_TYPES) but no GROQ query reads either. AwardsGrid.tsx reads the static
    lib/data/awards; society.province is free text, not a reference. Decide per type
    — wire it, or remove it from the Studio. Leaving them editable teaches the client
    that publishing does nothing. award most likely wants wiring (real content); province
    most likely wants removing (the free-text field works fine). Recommend, then implement
    — do not leave both open. Done when neither type is editable-but-inert, and the
    guide reflects the outcome.
milestones:
- id: M1
  name: Make a published edit reach the live site
  features:
  - F1
  - F2
  gate: contract
- id: M2
  name: Wire /national-show to its document
  features:
  - F3
  gate: contract
- id: M3
  name: Resolve the orphaned document types
  features:
  - F4
  gate: contract
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-08-05T21:36:32.070131+00:00'
last_active_at: '2026-08-05T21:36:32.070131+00:00'
started_at: '2026-08-05T21:36:32.070131+00:00'
---


# Mission — Close the CMS loop and wire the pages that ignore it

## Why

`cms-activation-deploy` closed 5 of 6 features but left the central claim false: **a
published Studio edit does not reach the live site.** Separately, an audit found pages and
document types the client can edit to no effect. Until both are fixed, "the CMS is usable"
is not a true statement about this site.

Secret rotation is explicitly DEFERRED to a single pre-launch pass (Brad, 2026-08-05).
`hostSociety` assignment is DEFERRED — needs Brad's domain knowledge.

## Milestones

### M1 — Make a published edit reach the live site (closes F6)

**F1. Purge the CDN on revalidate.**
Root cause is diagnosed and verified verbatim against
`nextjs.org/docs/app/guides/cdn-caching`: `revalidateTag()` invalidates only the Next.js
server cache; the CDN keeps serving its copy until `s-maxage` expires unless a CDN purge is
triggered alongside it. `app/api/revalidate/route.ts` calls `revalidateTag` and stops.
Read `docs/f6-cdn-invalidation-investigation.md` first — do not re-derive.

Investigate whether App Hosting exposes a purge API; the deployed host returns
`cache-tag: <numeric>` and `cache-tag: <numeric>:saoc-prod` headers that look built for it.
A shorter `s-maxage` is a legitimate fallback if no purge API exists — state the trade-off,
do not silently choose it.

Done when: `contracts/checks/f6-prove-cms-loop/check-studio-edit-reaches-site.mjs` (A1)
flips FAIL→PASS **without weakening the check or lengthening its 120s bound**, and the full
`contracts/f6-prove-cms-loop.yaml` gate is green.

**F2. Fix `/events/[slug]` revalidation tags.**
`app/(marketing)/events/[slug]/page.tsx` tags its `sanityFetch` calls `['events']` — no
`'sanity'` tag, and `'events'` matches neither the real document `_type` (`societyEvent`)
that a webhook sends. So event pages will not revalidate even once F1 lands. Independent
of F1; do not conflate them in one assertion.

Done when: a published edit to a `societyEvent` reaches its live `/events/<slug>` page,
asserted the same way A1 asserts `/about`.

### M2 — Wire `/national-show` to its document

**F3.** `app/(marketing)/national-show/page.tsx` fetches only `showClassesQuery` and
`pastShowsQuery`. Title, dates, venue, host, hero image and exhibitor stages are literal
JSX, so F4's seeded `nationalShow` singleton is inert — the client edits it and nothing
happens. `nationalShowQuery` already projects the needed fields (`sanity/queries.ts:30-39`).

Note the one field that DOES work: `nationalShow.countdownDate` drives the **home page**
countdown via `ShowBand`. The `/national-show` page's own countdown is a hardcoded constant
in `components/show/ShowCountdown.tsx:5` — wire that too.

Caution: this page is heavily hardcoded and intersects the pending Claude Design handoff.
Wire data flow only; invent no visual design and restructure no layout.

Done when: editing title/venue/hero in the Studio changes the deployed page, proven by a
round trip like F6's — not by asserting the query exists.

Then update `docs/secretary-cms-guide.md` §7 and the top "What You Can and Cannot Change
Yourself" section, which currently tell her this page is not editable.

### M3 — Resolve the orphaned document types

**F4.** `award` and `province` appear in the Studio sidebar (`sanity/structure.ts`
`COLLECTION_TYPES`) but no GROQ query reads either. `AwardsGrid.tsx` reads the static
`lib/data/awards`; `society.province` is free text, not a reference.

Decide per type: wire it, or remove it from the Studio. Leaving them editable teaches the
client that publishing does nothing. `award` most likely wants wiring (real content);
`province` most likely wants removing (free-text field works fine). Recommend, then
implement — do not leave both open.

Done when: neither type is editable-but-inert, and the guide reflects the outcome.

## Standing constraints

- Chain: @architect (contract + goldens) → @dev → @qa → @docs → gate → @maintainer.
  No contract, no @dev. Orchestrator dispatches, never implements.
- **Every contract needs a positive-path assertion against the user-visible outcome.** A
  green gate is not a working feature — that failure recurred twice last mission.
- Verify gates directly rather than accepting an agent's report; that caught three false
  results last session.
- Never kill/restart the dev server on :3333 (Brad's), no `pkill`; never `pnpm build` while
  it is up (shared `.next`).
- Never `git add -A` — `branding/`, `design/`, `documents/` must never be staged.
- Extract secrets with `grep '^KEY=' .env.local | cut -d= -f2-`, never dotenv — its stdout
  banner corrupted two Secret Manager payloads and cost two sessions.
- A SKIP must never report as PASS (Athanor#1322).
- Deploy authorization is standing; pre-production dev site.

## Deferred — do not attempt

- **Secret rotation** — single pre-launch pass, Brad's call (2026-08-05).
- **`hostSociety`** for the 18 events — Brad's domain knowledge.
- Resend/DNS — `saoc.co.za` not owned yet.
