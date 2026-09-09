---
schema: athanor.mission/v1
slug: national-show-ia-alignment
goal: 'Align the /national-show subsection''s page structure to Lee-Ann''s Drive folder
  structure and Website Development Specification V3: build the full 18-page event-site
  IA, wire real Drive copy where it exists, and render a prominent AI-generated-placeholder
  banner on every page whose copy is not yet supplied by the council. Preserve all
  existing work (vendors flow, tickets, archive).'
created_at: '2026-09-09T20:44:53.886880+00:00'
started_at: '2026-09-09T21:19:42.505184+00:00'
last_active_at: '2026-09-09T21:19:42.505184+00:00'
status: in_progress
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: M1
  feature: F1
  ts: '2026-09-09T21:19:42.505184+00:00'
features:
- id: F1
  status: pending
  inline_brief: >-
    showPage / showPageSection / showPageSettings Sanity types. provenance is a required
    three-value enum (council-supplied | research | placeholder-ai) with NO initialValue, so
    a section cannot be published until an editor makes an explicit choice. Registered in
    sanity/schemas/index.ts; showPageSettings pinned in structure.ts, showPage listed as a
    collection.
- id: F2
  status: pending
  inline_brief: >-
    content/drive-recovered/ - the four hand-salvaged council documents (13.1 ticketing,
    13.2 vendor form, 6 symposium theme, 17.1 FAQ) moved out of the gitignored session
    sandbox into a committed sibling tree that execution/drive_docx_sync.py never writes to,
    each with a recovery.json recording source Drive path, source md5 and salvage method.
- id: F3
  status: pending
  inline_brief: >-
    The gate. lib/data/show-pages.ts loader exposing section prose only as an opaque
    GatedProse value, components/nos/ShowPageProse.tsx as its only renderer with notice and
    copy in one inseparable expression, and a fail-loud resolveNotice that notifies on every
    state except an affirmative, source-verified council-supplied.
- id: F4
  status: pending
  inline_brief: >-
    Seeding. 17 content/show-pages/*.json sources (spec entries 1-13 and 15-18) and
    scripts/seed-show-pages.ts with a pure exported decideSectionAction: create what is
    missing, update only what the script itself last wrote untouched (seedHash match),
    skip-and-report anything a human has edited. Never createOrReplace.
- id: F5
  status: pending
  inline_brief: >-
    M2 shared entities: showExhibitorProfile and showGuestProfile document types per spec
    2.6 and Section 7 - one profile serving multiple roles (speaker, judge, exhibitor,
    researcher), country, specialities, products, confirmation status. Carries the same
    required provenance enum as showPageSection: an invented exhibitor is a named business a
    visitor may plan a trip around. Wires the entityList section kind.
- id: F6
  status: pending
  inline_brief: >-
    M2 programme model: showSession with speaker references, day/time/venue, capacity, and
    the programme section kind. Serves spec entries 6 (Symposium), 7 (WOSA), 11 (Programme)
    and 12 (Workshops) off one structure, per spec 4.7's requirement that WOSA reuse the
    Symposium's Speaker/Presentation/Programme structures.
- id: F7
  status: pending
  inline_brief: >-
    M2 relational awards and sponsors: sponsorship level and archive fields on the existing
    sponsor type (spec 4.15 - archive expired sponsors, never delete), and the
    Orchid-Exhibitor-Judge-Category-Photo-ShowYear relation spec 4.8 requires as a permanent
    cross-show archive. Extends the existing sponsor and judge types, does not replace them.
- id: F8
  status: pending
  inline_brief: >-
    M2 entity seeding and verifier extension: seed only the entity records that genuinely
    exist, mark every unsupplied one placeholder, and extend
    scripts/checks/verify-show-page-m1.ts with entity-level provenance checks so an
    unconfirmed exhibitor or guest cannot render as confirmed.
- id: F9
  status: pending
  inline_brief: >-
    M3 researched placeholder copy for the ten spec entries with no council copy at all (1,
    5, 7, 8, 9, 10, 11, 12, 15, 16), written from each entry's own spec Section 4 Purpose
    and Key-content lines. Every section provenance placeholder-ai. Replaces M1's honest
    stubs via the seedHash reconciliation, with no migration.
- id: F10
  status: pending
  inline_brief: >-
    M3 gap-filling on the thin entries (3, 4, 6, 17, 18): the operational facts spec 4.3 and
    4.9 ask for that Lee-Ann's marketing prose does not carry - hours, parking, photography
    policy, cloakroom, accessibility - as separate sections marked research where a real
    external source exists and placeholder-ai otherwise. Never merged into a
    council-supplied section.
- id: F11
  status: pending
  inline_brief: >-
    M3 content review. The WOSA subject-matter boundary is the hard one: /national-show/wosa
    may carry conference logistics (dates, programme, speakers, registration) but NEVER wild
    orchid identification, habitat, or conservation content - that belongs to WOSA and gets
    a link, per CLAUDE.md. Also POPIA before any personal name or email is seeded, and no
    price, date or venue stated unless a council source says it.
- id: F12
  status: pending
  inline_brief: >-
    M4 route scaffolding and navigation. Create the eleven new routes under
    app/(marketing)/national-show/ per route-map.golden.md, each a Server Component
    consuming loadShowPage and rendering through ShowPageProse. Wire every one into
    nav-config.ts, ShowSectionNav's SECTION_LINKS, or the landing page's quick links, plus
    the /societies link that is all spec entry 14 gets. A 200 nothing links to is the
    archive defect repeating.
- id: F13
  status: pending
  inline_brief: >-
    M4 reconcile the six existing routes onto their showPage documents without moving any of
    them: the /national-show landing page (spec entry 1 - a subsection landing page, never a
    home page), what-to-expect, workshops, plan-your-visit, faq and the tickets document.
    Must not disturb showVisitorInfo's existing confirmationStatuses markers on the three
    pages that already have them.
- id: F14
  status: pending
  inline_brief: >-
    M4 build the entity-backed pages against M2's types: 4 and 5 (exhibitor and guest
    directories, filterable, with confirmation status), 8 (judging and awards), 11
    (programme in list and calendar form), 15 (sponsors by tier). Composes from
    components/nos/* only - no new colours, fonts, radii or shadows, and no edits to
    nos-theme.css.
- id: F15
  status: pending
  inline_brief: >-
    M4 deployed verification. Playwright across all seventeen pages proving every page whose
    pageProvenance is not council-supplied renders its notice above the fold before any body
    copy, that no page renders section copy without one, and that every route is reachable
    by clicking. The M1 verifier proves the module boundary; this proves the running site.
- id: F16
  status: pending
  inline_brief: >-
    M5 source recovery with the council: Lee-Ann re-exports the truncated 17.1 FAQ .docx
    (its zip central directory is missing in Drive itself - our download is byte-perfect
    against Drive's md5, so the breakage is upstream), and renames the 13.
    Registration/Booking/Tickets folder whose embedded slash makes drive_docx_sync.py reject
    it. Both replace hand-salvage with real sync.
- id: F17
  status: pending
  inline_brief: >-
    M5 open-questions register: contact routing (one enquiries@ address versus
    per-department, spec 4.18 - Lee-Ann is still asking), ticket and cocktail option
    finalisation (spec 2.7 - still needs to be fully developed, and the ticketing doc
    contradicts itself on the Early Bird Weekend Pass), the unanswered About banking-details
    purpose (spec Section 5), and which exhibitor contact fields are POPIA-safe to hold.
milestones:
- id: M1
  status: pending
  features:
  - F1
  - F2
  - F3
  - F4
- id: M2
  status: pending
  features:
  - F5
  - F6
  - F7
  - F8
- id: M3
  status: pending
  features:
  - F9
  - F10
  - F11
- id: M4
  status: pending
  features:
  - F12
  - F13
  - F14
  - F15
- id: M5
  status: pending
  features:
  - F16
  - F17
---

# Mission: Align the /national-show subsection's page structure to Lee-Ann's Drive folder structure and Website Development Specification V3: build the full 18-page event-site IA, wire real Drive copy where it exists, and render a prominent AI-generated-placeholder banner on every page whose copy is not yet supplied by the council. Preserve all existing work (vendors flow, tickets, archive).

## Context

Spec: `content/drive-source/National Show/1. Website Development SpecificationV3/v1.0/content.md`.
Section 1B is the 18-page National Show sitemap; Section 4 gives Purpose / Key content /
Key functionality / Recommendation per page; Section 2 is the global standards (2.1 and
2.8 require non-technical SAOC users to edit every page in Sanity without a developer,
2.6 requires shared entities to be created once and referenced).

Research, all claims file-and-line cited:
`.agent/memory/scratch/research-national-show-ia-alignment.md` (per-page copy
inventory, route reconciliation, Lee-Ann's ~24 inline replies verbatim, ticketing model).

Copy status across the 18 pages: REAL on 2 and 13. THIN on 3, 4, 6, 17, 18. NONE on
1, 5, 7, 8, 9, 10, 11, 12, 14, 15, 16 - and pages 8, 9, 10, 14, 16 have no Drive folder
at all.

Brad's hard condition, which M1 exists to satisfy: researched placeholder copy is allowed
on the pages the council has not written, but it must be unmistakably marked as
placeholder, AI-generated, awaiting proper copy from the Orchid Council - and it must be
structurally impossible for placeholder copy to render without that notice. Not a banner
someone remembers to add.

Site hierarchy, binding, `.agent/memory/project/rules.md`: saoc.co.za is the home and the
only home page. `/national-show` is a SUBSECTION - a promotional event area for a show that
runs every three years, branded as if it were a different company, but that branding is
presentation only. Lee-Ann's spec entry "1. Home" therefore means the `/national-show`
landing page, which already exists; it is reconciled, never created, and never called a home
page. With spec entry 14 being a link to `/societies` rather than a page, the sitemap's 18
entries produce 17 showPage documents and 16 pages to build.

Scope, revised by Brad on 2026-09-09 (this reverses the original brief): this session builds
the marketing pages of the subsection - routes, page templates and composition - as well as
the content model and the copy. What stays out is INVENTING VISUAL DESIGN: no new colours,
fonts, logos, radii or shadows, no edits to nos-theme.css, and no third component library.
The peer session `saoc-nos-design-cc` ("Codi") is the design authority on look and design is
a conversation with them, not a handoff. Never touch the SAOC parent site or a sibling
section. Route decisions and both conflict resolutions are in
`.agent/memory/project/specs/national-show-ia-alignment/goldens/m1/route-map.golden.md`; the
design-consultation protocol is in the same directory's `codi-handover.golden.md`.

Untouchable: `ticketType` and the ticketing flow; the gated vendor subsystem
(`vendorApplications`, `vendorSubmissions`, `vendorStandOrders`, `/national-show/vendors/*`,
`/api/vendors/*`); `showVisitorInfo` and its `confirmationStatuses` markers; `nos-theme.css`
and the NOS token layer.

Binding client direction from Lee-Ann's own inline replies: page 14 (Orchid Societies) is a
link/button through to the SAOC societies pages, not a duplicate directory. Ticket pricing
is NOT finalised despite appearing in the ticketing doc - do not present it as final.

Two facts that exist nowhere else and must survive: venue is Stellenbosch Flying Club, R44
northbound to Stellenbosch; theme is "From Wild Origins to Cultivated Excellence: The
Future of Orchids".

## Notes

