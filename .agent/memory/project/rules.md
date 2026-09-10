# Project-Specific Rules

_These override core rules when they conflict. Populated during /onboard._

## Scope

- Only read/write files inside this project directory.
- Never touch sibling project directories without explicit instruction.
- Template updates: `make update-template` (never edit template files directly).

## Team-First Mandate
- Always use specialized agents (@lead, @dev, @qa, etc.) for complex or batch operations to ensure quality and exercise the framework.

## Add project overrides below

### QA Guard Hardcoded Secrets Exclusion
The `qa_guard.sh` script (located in `.agent/pulse/registry/qa_guard.sh`) has been modified to exclude the `contracts/` directory from its hardcoded secret detection. This prevents false positives that would otherwise occur due to contract assertion commands legitimately containing `api_key`, `secret`, `password`, or `token` keywords when checking for environment variables.

<!-- Example:
## Tech Stack Rules
- TypeScript strict mode, no `any`
-->

### Visual work is not done until a browser has seen it

**Any change that affects what a page looks like MUST be verified in a real browser before it
is reported as complete.** Use the `BrowserAgent` agent (Playwright) to load the page and
capture screenshots at desktop (1440px) and mobile (375px and 320px), tab through every
interactive element to confirm visible focus, and check the console for errors.

**Why:** contract assertions and structural greps cannot see a rendered page. On 2026-08-15
the admin login page shipped with a green 6/6 gate while rendering as bare text with
*invisible input fields*, and the dashboard and door scanner behind it were raw unstyled
HTML. Every check passed. The user found all of it. A designer agent reading back its own
Tailwind class names is not verification — it is the same claim restated.

**How to apply:**
- A design/UI agent with no browser MUST say so and MUST NOT call the work confirmed.
- Dispatch `BrowserAgent` at the deployed URL (or a local dev server) and require it to
  describe rendered pixels, not source. Tell it to be blunt if the page looks wrong.
- Check the pages *behind* the one reported. The login fix was requested; the dashboard one
  click away had the identical defect and nobody looked.
- Compare against a known-good page on the same site to confirm it belongs there.

### Site hierarchy — NOS is a SUBSECTION of saoc.co.za. Never re-litigate this.

```
saoc.co.za                     <- THE home. The South African Orchid Council's site.
  └── /national-show           <- the National Orchid Show (NOS). A SUBSECTION.
        └── its marketing pages
```

- **saoc.co.za is the home. There is exactly one home page, and it belongs to SAOC.**
- The **National Orchid Show (NOS)** runs **every three years** (next: 2027). It is a
  promotional event subsection of the SAOC site — a "promo event on the Council's site",
  not a site of its own.
- NOS is **branded as if it were a different company** — its own styling, its own identity,
  visually distinct from SAOC. That branding is *presentation only*. It does not make NOS a
  separate site, and it never earns NOS a home page of its own.
- **There is no NOS "Home" page.** Lee-Ann's `Website Development SpecificationV3` lists
  "1. Home" for the show; that means the **`/national-show` landing page, which already
  exists**. Do not create a home page for the show. Do not treat the show as a site root.
- **Scope of work on the show: the subsection only.** All marketing pages under
  `/national-show`. Never the SAOC parent site, never a sibling section.

**Why this is written down:** on 2026-09-09 the orchestrator presented Lee-Ann's spec page
"1. Home" as a page to be built, which reads as giving the show its own home page. Brad's
correction: "SAOC.co.za is the home. They're just a subsection, like a promo event."

### Invented copy must be notarised as invented

Most NOS pages have no copy from the council yet. Inventing placeholder copy is **approved by
Brad** — on one non-negotiable condition: **every page carrying invented copy must declare it,
visibly, at the top of the page.** The declaration is driven by a flag on the content itself,
so a page *cannot* render invented copy silently; it is never a banner someone remembers to
add. When the council supplies real copy and the flag is cleared, the notice disappears.

**Note:** `CLAUDE.md` is write-protected by `execution/hooks/check_autonomy.sh` (always denied),
so durable project rules go here, in `.agent/memory/project/rules.md`, which is loaded into
every session's boot context.

## NOS structure — APPROVED BY BRAD 2026-09-10, relayed via saoc-eb

17 pages under /national-show. Hub + four IA groups. This supersedes the 16-page draft
agreed earlier the same day; where the two differ, this section wins.

- Visit: /about (exists, deployed) · /what-to-expect (exists) · /plan-your-visit (exists) · /faq (exists, copy BLOCKED — her .docx is truncated in Drive)
- Programme: /programme (create) · /workshops (exists) · /symposium (create) · /wosa (create) · /conferences (exists, OWNED BY saoc-eb)
- Exhibit & Trade: /sa-exhibitors (create) · /international-guests (create) · /exhibitors (exists) · /vendors + /apply /register /payment (exists)
- The Show: /tickets (exists, OWNED BY saoc-eb) · /sponsors (create) · /archive + /archive/[year] (exists)

DELETED — do not build, and remove if present:
/national-show/upcoming (delete the route, NO redirect) · /plant-exhibition · /plant-sales ·
/judging-and-awards · /national-show/contact. Site-level /media-kit deletion belongs to saoc-eb.

Rulings:
- `/national-show/exhibitors` is the GROWER ENTRY GUIDE (entryProcess/fees/classes/judging/eligibility/display/sales/practicalities/permits). `/national-show/sa-exhibitors` is the PUBLIC NURSERY DIRECTORY from Lee-Ann's `4. South African Exhibitors`. Different audiences; both correct. The docx filename "1.1 SA Exhibitors" misleads — do not re-merge them.
- `/national-show/sponsors` is REINSTATED and needs its OWN DATA SCOPE — a new `showSponsor` type, never a filter or view over the site-level sponsor list. The Show's sponsors and SAOC's are different lists and must be able to diverge. Lee-Ann's NOS Sponsors folder is empty: placeholder copy under R11, real empty listing, never an invented sponsor.
- No NOS-level judging or contact page: site-level /judging and /contact exist and a duplicate splits real relationships or creates an unwatched inbox.
- No plant-exhibition or plant-sales page: the sales area is described inside the SA Exhibitors doc; the competitive display is What to Expect + Judging.
- `/national-show/conferences` keeps its slug (already a registration page). "Joint track" wording removed per spec §4.7 — owned by saoc-eb.
- /wosa links OUT to WOSA and generates NO wild-orchid conservation content. Standing ruling.
- Five layout archetypes, not seventeen page designs: hub, prose (FAQ is a prose variant), schedule, listing, transactional.
- Reachability is HUB-BASED, not header-based. There is no approved header dropdown; the handoff specifies a flat six-item nav. Every page must be reachable from the /national-show hub AND from ShowSectionNav. No assertion may depend on a header entry existing.
- Empty listings (/sa-exhibitors, /international-guests, /sponsors) name WHAT will appear and WHEN, with the page's own structure visible (heading, intro, shape of the coming card) and the absence stated in words. Never "no results". The rendered treatment is Codi's and is downstream of building.
- Owned by saoc-eb, do not edit: components/chrome/**, app/(marketing)/tickets/**, /national-show/tickets, /national-show/conferences, /sponsors, /judging, /contact, /societies, all redirects, all route deletions outside /national-show.
- Binding design rulings: R1 (SAOC chrome untouched), R11 (disclosure chip → sentence → dashed 2px rail, warning tokens for AI-generated, muted for researched, never error/red), R12 (no NOS header or second nav), R13 (grid orphan rule, columns derived from rendered count, never a hardcoded grid-cols class; when no c avoids the orphan, keep the content ceiling and let the FINAL CARD SPAN the remainder — never a partial row, never a centred lone card; binds at c>=3, EXEMPT BY RULING at c=2).

Process (Brad, 2026-09-10):
- LOCAL FIRST. Every page renders correctly on localhost:3000 before anything is pushed.
- The site is EARLY ALPHA — no real users, no bookmarks, no live payments. Route changes are free; never preserve a bad structure for migration safety.
- Branch for this lane is `nos-site`. `origin/nos-design` belongs to the design lane — never push to it.

- Design-ruling authority is Codi's `.agent/memory/project/design/nos-design-rulings.md` (R1-R13, commits 6687b13/5c103ea) IN CODI'S WORKSPACE. The same relative path in this tree is a STALE MIRROR and is not the authority. Cite rulings by number; never treat the local copy as canonical.

## Branch and PR rule — standing, all three lanes, 2026-09-10 (Brad delegated to saoc-eb)

NO LANE PUSHES TO `main`. EVER.

1. Work on your own branch. This lane's branch is `nos-site`. `origin/nos-design` belongs to the design lane — never push to it.
2. Slice done → open a PR against `main`.
3. Cross-lane review: NOS lane PRs reviewed by saoc-eb (lead); saoc-eb's PRs reviewed by this lane; design-lane rulings reviewed by saoc-eb.
4. One approving review, then merge. No self-merge. No exception for "it's only a docs change".
5. The PR description states which routes it adds/changes/deletes and what evidence backs the assertions — rendered-output snapshots for anything claiming a route property, never a path check.
