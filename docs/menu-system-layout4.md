# Menu System — Layout 4

Mission `menu-system-layout4`, opened and built 2026-09-10. This is the primary
site nav — the "National Show ▾" dropdown on desktop, and its mobile drawer
equivalent — rebuilt to Brad's approved **Layout 4**, chosen from four
populated options in artifact `b9eadbd4-e165-4de9-884d-86acc9fbf2a2`.

Read this if you're opening the codebase cold and need to know: what the nav
looks like, where its data comes from, why one line is missing on the live
site right now, and why its test suite is shaped the way it is.

## Layout 4 is layout only

Brad, twice, framing the approval:

> "this is the design/style we need to approve the drop down system look etc,
> not a redesign"

> "we just building a menu system the system use the predefined designs we
> already have, I just need to see how the nesting / layouts or whatever you
> call them are going to work."

No new colours, faces, sizes, spacing values, or components were authorised by
this mission. Every visual value in the four chrome components traces to
`design/design_handoff_saoc/colors_and_type.css` and
`design/design_handoff_saoc/src/styles.css` — never invented, per
[`docs/rules/no-invention.md`](rules/no-invention.md). If you need a value the
handoff doesn't define, that's a gap to name and ask about, not a judgement
call.

## The shape

Seven top-level items plus a Contact button:

    About · Societies · Judging & Awards · Events · Members · National Show ▾ · Sponsors

All 17 `listed: true` National Show routes from
`content/national-show-routes.json` live inside **one** National Show mega —
not three separate top-level megas the way the site had them before. The mega
is five tracks:

| track | contents |
|---|---|
| lead block | mono eyebrow "The National Show"; serif lead "19th SAOC National Orchid Show" linking `/national-show`; a venue+dates meta line; "The Show" group (Tickets / Show Sponsors / Past Shows) folded in underneath |
| Visit | 4 leaves |
| Programme | 5 leaves |
| Exhibit & Trade | 4 leaves |
| feature rail | bone panel: mono date meta, serif "Tickets" heading, primary "Buy tickets" button |

Every leaf is a bold 14px name over a 12px muted descriptor. `components/chrome/MegaMenu.tsx`
renders this as a full-width sheet, `absolute inset-x-0 top-full`, spanning the
header rather than a narrow panel anchored under the trigger. Disclosure
semantics — `aria-haspopup`, `aria-expanded`, open on click or Enter/Space,
Escape closes and returns focus to the trigger, outside click and blur-outside
close — were already correct before this mission and were kept verbatim; only
the panel's contents and sizing changed.

`components/chrome/MobileMenu.tsx` carries the drawer equivalent: tap "National
Show" to expand, and inside it the feature block sits first, then the lead
block, then the four groups (The Show, Visit, Programme, Exhibit & Trade) as
flat headed lists — no per-group sub-accordion. Mobile drawer link text never
exceeds 17px, the handoff's own cap (`design/design_handoff_saoc/src/styles.css`
371–419) — a hard constraint from an earlier round where Brad said the mobile
menu font was "way too big."

The data both components render from is `components/chrome/NAV` in
`components/chrome/nav-config.ts`. `Header.tsx` doesn't special-case any of
this — it still dispatches generically (`n.type === 'mega' ? <MegaMenu item={n} />
: <Link>`), so the National Show mega's lead/columns/featureRail fields are
entirely `MegaMenu.tsx`/`MobileMenu.tsx`'s concern.

## Descriptors are not free text

Every leaf's `descriptor` string in `nav-config.ts` is a **trimmed prefix** of
that route's own `purpose` field in `content/national-show-routes.json` —
never authored copy. This is mechanically enforced, not eyeballed:
`contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs`
loads the manifest and the real `NAV` export, and fails naming any descriptor
that isn't a prefix of its row's `purpose`.

The manifest resolves in order: the working tree copy of
`content/national-show-routes.json` if present, else
`git show origin/nos-site:content/national-show-routes.json` — because as of
this mission the manifest still lives on the `nos-site` branch, not yet merged
to `main`. If neither resolves, the checker prints `SKIPPED` and exits 3 (the
suite runner's dedicated skip code), never exits 0 — an earlier draft of this
checker exited 0 on an unresolved manifest, which let a skip land as a silent
PASS; that was found and fixed during this mission (2026-09-10).

One entry needed a manual override that later had to be undone: ruling R3
renamed the WOSA route from the manifest's own slug `/national-show/wosa` to
`/national-show/wosa-conference` (WOSA — Wild Orchids of Southern Africa — is
a separate partner organisation; `/wosa` was kept free for a possible future
partner page). The checker originally carried a hard-coded alias mapping the
new slug back to the old one so descriptor lookups still resolved. Once the
NOS lane's manifest itself started carrying `wosa-conference` directly
(commit `c2a1bcea`), that alias rewrote a good href into a slug the manifest
no longer had — so it was deleted in the same commit. If you're chasing a
"no manifest row found" failure for the WOSA leaf, check first whether the
manifest and the alias have drifted out of sync again before reintroducing one.

## The date line is deliberately absent

If you look at the live site right now, the lead block and feature rail have
no visible date line — just the venue (or nothing). **This is intended
behaviour, not a bug**, and it will look like something is missing when Brad
tests tomorrow.

`NavMegaLead.meta` and `NavMegaFeatureRail.meta` carry no literal copy in
`nav-config.ts` — the file's own comment says so explicitly: "no literal
copy here — they are a shape only." Both are computed at render time by
`MegaMenu.tsx`/`MobileMenu.tsx` from the `nationalShow` Sanity singleton via
`lib/show-identity.ts`'s `formatShowDateRange`, the same module that already
exists to stop the site advertising two different show dates in one viewport.
As of this mission, the singleton's `showDate`/`showEndDate` are both `null`
in production, so `formatShowDateRange` returns `null`, the lead line renders
venue-only with no dangling separator, and the feature rail's meta renders
nothing at all — cleanly omitted, not a blank placeholder.

Entering the real dates into the Studio makes the date line appear with
**zero code change**. Inventing a placeholder date, or any wording for it,
is exactly what `docs/rules/no-invention.md` forbids — the underlying facts
(The Hangar, Stellenbosch Flying Club; Thu 16 – Sun 19 Sept 2027) are
confirmed elsewhere in project memory, but composing them into nav copy ahead
of a Studio entry would be new copy, not sourced copy. Two other gaps are
tracked the same way in
`.agent/memory/project/specs/menu-system-layout4/goldens/f1-gaps.json`:
`featureRail.blurb` (no source anywhere, so it's omitted entirely rather than
filled with a plausible sentence) and whether any group heading should link
somewhere (`headingHref` is `null` on every group today — a reversible,
one-line architect judgement call, not an invented visual element).

## Six routes are exempt from the 200 check, and why that's safe

The National Show route build was split across two lanes: this lane built the
chrome (nav data, `MegaMenu`, `MobileMenu`, `Header`), and a separate `nos-site`
lane built the pages the chrome now links to. At the point this mission's gate
ran, six of the manifest's 17 routes had no `page.tsx` anywhere on `main` yet:

    /national-show/programme
    /national-show/symposium
    /national-show/wosa-conference
    /national-show/sa-exhibitors
    /national-show/international-guests
    /national-show/sponsors

The single source of truth for that list is
`.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-pending-nos-routes.json`.
`e2e/nav-links-200.spec.ts` and `e2e/mobile-nav-reaches-every-section.spec.ts`
both read it and `test.skip()` those destinations by name, rather than
silently omitting them — an auditable gap, not a silent one.

Two mechanisms stop that exemption list from quietly becoming permanent:

1. **`check-pending-routes-still-pending.mjs`** re-checks, against a stated
   git ref, that every route still listed as pending is genuinely still
   unresolved. If one has actually shipped, it fails and names it — a
   pending-routes list can go *stale* (claim a route is missing when it
   isn't), and this is what catches that.
2. **`check-nav-links-200-gated-by-exemptions.mjs`** is the complement: it
   refuses to report the "no 404 reachable from the header" property as
   satisfied — SKIP, never PASS — while `pendingRoutes` is non-empty. That
   closes the other failure mode: without it, a correct fix to
   `nav-links-200.spec.ts`'s own stale-import bug (it used to import an older,
   under-inclusive 4-of-6 pending list) would have made the spec report
   "0 failed, 6 skipped" and exit 0 — a naive read of that exit code alone
   would have classified the run PASS having actually measured only 11 of 17
   manifest hrefs.

Together, neither failure mode is possible alone: the list can't go stale
(caught by #1) and it can't become permanent (caught by #2).

As of this mission's close, the `nos-site` lane has built all six missing
routes on `origin/nos-site` at `07bae448` — so
`f1-pending-nos-routes.json`'s list empties out, and property 1 goes green for
real, once that branch merges to `main`. Whoever performs that merge should
re-run `check-pending-routes-still-pending.mjs` against the merged tree and
empty the fixture down to whatever, if anything, is still genuinely missing.

## Why the tests are shaped the way they are

This matters more than the feature description above, because this exact
menu shipped a regression once already: **Tickets went from reachable to
unreachable while every contract assertion passed.** The pre-mission gate
enumerated the NAV *data export* — checked that `nav-config.ts` contained the
right hrefs — and never once read the rendered HTML. `MegaMenu.tsx` and
`MobileMenu.tsx` both gated their only CTA on `item.ctaLabel`, a field
`nav-config.ts` never actually set on the National Show mega, so
`item.lead` and `item.featureRail` were dead data: `/national-show` itself,
and both Tickets hrefs, had no rendered anchor anywhere on the site. Every
assertion that only inspected `nav-config.ts` was green throughout.

The suite was rebuilt around that failure, deliberately:

- **`e2e/nav-rendered-reachability.spec.ts` opens the real flyout and drawer
  and reads actual anchors, then trial-clicks each one.** A Playwright
  `click({ trial: true })` runs the full actionability check — attached,
  visible, stable, receiving pointer events at its own hit-target point, and
  enabled — without navigating. Visible is not the same as reachable: an
  anchor with `pointer-events: none`, or one sitting under a positioned
  overlay, passes a plain `toBeVisible()` check while a real user still can't
  click it. This spec is what caught `item.lead`/`item.featureRail` being
  unread in the first place — confirmed failing against the pre-fix tree
  during contract authoring, naming `/national-show` and both Tickets hrefs
  as present in the DOM data but absent from the rendered, opened header.

- **`e2e/nav-keyboard-operable.spec.ts` asserts focus lands *inside* the open
  panel, not merely that something has a focus ring.** An earlier version of
  this spec Tabbed once after opening the panel and checked for a focus
  ring — which would still pass if the panel were empty or unreachable,
  because Tab would just land on the next header control (e.g. Contact),
  which has its own ring. Fixed (Codex cross-model review, 2026-09-10) to
  assert the focused element is a descendant of the open `role="menu"` panel
  *and* is specifically the first focusable leaf in the panel's real DOM
  order, derived from `NAV` rather than hardcoded.

- **`e2e/mobile-nav-reaches-every-section.spec.ts` derives its destinations
  from `NAV`, not a hand-copied list, with a two-way consistency check
  against the shared collector.** Before this mission, this file, plus
  `nav-links-200.spec.ts`, plus `nav-rendered-reachability.spec.ts` each had
  their *own* independent copy of "every href in NAV" — three lists that
  could silently drift apart. `e2e/utils/collect-nav-hrefs.ts` now holds the
  one shared implementation; this spec's own `deriveGroups`/`deriveFlatDestinations`
  functions are compared against `collectHrefs(NAV)` in both directions at
  module load time (not just "everything I derived is in the collector," but
  also "everything the collector found is in what I derived") and throw
  immediately if the two have diverged.

- **`e2e/utils/collect-nav-hrefs.ts` walks every href-bearing field**,
  including `lead.leadHref`, `lead.theShow.headingHref`, each
  `column.headingHref`, and `featureRail.ctaHref` — not just the flat
  `item.href` + `columns[].links[].href` shape the pre-Layout-4 nav had. The
  reasoning is direct: a link this collector cannot see is a link none of
  these tests can ever fail on, which is exactly how the original regression
  went unnoticed.

If you're tempted to simplify this suite back down to checking `nav-config.ts`'s
exports — don't. That's the precise shape of test that let the original
regression through.

## F7 — visual fidelity fix (2026-09-10/11)

F1-F5 landed the Layout 4 render path correctly: every leaf, descriptor, the
lead block, and the feature rail were present and wired to real hrefs. What
had drifted, in roughly a dozen places, was the *visual treatment* against
the approved artifact — Brad, looking at `beta.saoc.co.za`: **"Menu has no
borders... looks weird."** That was correct and specific. F7 closed the gap
between the render path and artifact `b9eadbd4-e165-4de9-884d-86acc9fbf2a2`
("SAOC Menu Flyouts"). Full detail, including every measured value and its
artifact citation, lives in the two goldens this feature was built against —
`.agent/memory/project/specs/menu-system-layout4/goldens/f7-layout4-visual-fidelity.json`
and `f7-featurerail-blurb.json` — this section summarises them for a reader
who doesn't want to open JSON.

### The visual gaps, and where they trace in the artifact

All against `components/chrome/MegaMenu.tsx`'s desktop sheet (`[role="menu"]`).
Class names below are the artifact's own CSS rule names, so you can find each
one directly in the artifact export.

- **Column rules (`.dd4__col`, `.dd4__feature` — Brad's actual complaint).**
  Each of the three group columns and the feature rail now carries a real
  `1px solid --rule-soft` **left** border plus 24px horizontal padding
  (`border-l border-rule-soft px-6`). The lead block (first track, no left
  neighbour) carries neither — only its own `pr-6`. Before F7 none of the
  five tracks had any border at all; spacing came entirely from a `gap-10`
  on the grid.
- **The sheet's real shadow (`.sheet`).** The panel used `shadow-float`, a
  class scoped by its own comment (`app/globals.css:78-79`) to nav-on-scroll,
  and never registered under Tailwind's `@theme --shadow-*` namespace — so it
  was very likely rendering with no shadow at all, not merely the wrong one.
  Fixed with a dedicated `--shadow-sheet` token
  (`0 20px 44px rgba(23,25,23,.09)`, `app/globals.css:83-88`) wired through
  `@theme` and applied as `shadow-sheet`.
- **Grid track ratios (`.dd4__inner`).** `grid-cols-[2fr_1fr_1fr_1fr_2fr]`
  with a 40px `gap-10` and symmetric `py-10` became
  `grid-cols-[1.05fr_1fr_1fr_1fr_.9fr]` with `gap-x-0` and asymmetric
  `pt-8 pb-6` (32px/24px) — the lead track is only marginally wider than a
  group column, and the feature rail is *narrower*, not doubled. The old
  ratios rendered the lead and feature rail as equal, oversized blocks; the
  artifact's are close to even, with the rail slightly recessed.
- **Group-heading typography (`.dd-head`).** Was `font-serif text-[16px]
  font-medium text-ink` — large, dark, serif. Now `font-mono text-[10px]
  uppercase tracking-[0.18em] text-accent` — small mono caps in brass. This
  was, by itself, one of the most visually obvious gaps in Brad's
  screenshot: a heading style that reads as body-adjacent versus the
  artifact's small eyebrow-weight label.
- **The invented pill badge.** The lead eyebrow ("The National Show") had
  been rendered as a filled, rounded pill
  (`rounded-pill bg-bone px-3.5 py-1.5 ... text-primary`) — a shape and
  background the artifact has nowhere. It is, structurally, the exact same
  `.dd-head` label as the group headings, just applied to different copy.
  The pill had no artifact source at all; it may have been carried over from
  an unrelated eyebrow-pill pattern elsewhere on the site (see
  `app/globals.css`'s `--radius-pill` comment, "eyebrow pills only"). F7
  removed the pill styling entirely and applies `.dd-head` typography.
- **Lead link and lead meta sizing (`.dd-lead` / `.dd-lead-sub`).** Lead link:
  20px/font-medium/no line-height/`mt-4` → 23px/font-semibold/`leading-[1.12]`/
  no top margin (vertical rhythm now comes from the eyebrow's own
  `mb-3`/margin-collapse, matching the artifact, which has no margin-top on
  `.dd-lead` at all). Lead meta line: `font-mono text-[12px]` with a top
  margin → inherited sans, `text-[12.5px]`, `max-w-[32ch]`, `mb-4` only — the
  meta line was wrongly set in mono; the artifact inherits the ambient sans.
- **Leaf separator token.** Leaf `<li>` dividers switched from `border-rule`
  (the stronger hairline) to `border-rule-soft`, matching the artifact's
  fainter divider weight between leaf rows specifically (column/rail
  dividers use the same soft token, described above).
- **Feature-rail meta and heading (`.dd4__meta`, `.dd4__feature h4`).** Meta:
  `font-mono text-[12px]` (no letter-spacing/case) → `text-[10px]
  uppercase tracking-[0.14em]` — note this is a *different* tracking value
  from the group headings' `0.18em`; don't substitute one for the other.
  Heading: 20px/font-medium/`mt-2` → 18px/font-semibold/`leading-[1.15]`/
  `mb-[6px]`, with the vertical gap moved to be the meta line's own
  bottom margin rather than the heading's top margin.
- **The CTA button (`.btn`).** `rounded-sm` (Tailwind's built-in radius
  scale, unrelated to this project's own `--radius-1: 2px` token) →
  `rounded-[2px]`; `text-[14px]` → `text-[13.5px]`; symmetric `px-4 py-2`
  (16px/8px) → the artifact's asymmetric `px-[18px] py-[10px]`; added
  `tracking-[0.01em]`. `font-medium` (500) was already correct and unchanged.

### The feature-rail blurb is artifact-sourced chrome copy, not a leaf descriptor

`item.featureRail.blurb` ("Day, weekend and VIP admission for the 19th
National Show.") was empty at F1 — `docs/rules/no-invention.md` forbade
filling it with plausible-sounding copy with no traceable source. F7 found
the sentence verbatim in the approved artifact's own `.dd4__feature` mockup
markup (`goldens/f7-featurerail-blurb.json` records the exact grep). It is
now set directly in `nav-config.ts` and rendered by `MegaMenu.tsx`.

This string is **not** covered by
`contracts/checks/menu-system-layout4-f1/check-descriptor-provenance.mjs` —
that checker's provenance mechanism is shaped specifically around leaf
descriptors, which must be a trimmed prefix of their own route's `purpose`
field in the manifest (`content/national-show-routes.json`). The feature
rail has no manifest row at all, so that checker's mechanism doesn't apply
here by design, not by oversight. The blurb gets its own, separate
provenance check instead:
`contracts/checks/menu-system-layout4-f7/check-featurerail-blurb-provenance.mjs`,
tied to `f7-featurerail-blurb.json`. That checker proves the *string* is
byte-identical to its golden; it does not prove the string renders anywhere
— that's `e2e/mega-menu-layout4-visual-fidelity.spec.ts`'s "feature rail: no
border-radius..." test (A5), which reads the real DOM.

### Site-wide font-token bug (also documented in `CLAUDE.md` — it isn't menu-scoped)

The single most consequential fix in F7 wasn't visual at all: every
`font-serif`/`font-sans`/`font-mono` utility site-wide had no generic
CSS-keyword fallback. Root cause, two independent bugs stacking:

1. `app/globals.css` previously declared `--font-family-serif`/
   `-sans`/`-mono` under `@theme` — but Tailwind v4 doesn't recognise that
   namespace at all. The real theme keys, matching the utility class names
   1:1, are `--font-serif`/`--font-sans`/`--font-mono`
   (`node_modules/tailwindcss/theme.css`).
2. `app/layout.tsx`'s `next/font` loaders set `variable: '--font-serif'` /
   `'--font-sans'` / `'--font-mono'` — the *exact same names* as Tailwind's
   own reserved theme keys. Even after fixing (1) to point at the real
   `--font-*` keys, next/font's own two-entry fallback list (loaded font,
   then its metrics-matched fallback face — no generic keyword) would still
   win the cascade over an `@theme` declaration referencing the same name.

The fix required all three changes together — verified by direct testing
that any one alone reproduces the same inert result:

- `app/layout.tsx`: each loader's `variable` renamed to a non-colliding name
  — `--font-serif-loaded` / `--font-sans-loaded` / `--font-mono-loaded`.
- `app/globals.css:35-37`: `--serif`/`--sans`/`--mono` point at those renamed
  vars, each with the project's full fallback stack ending in a real generic
  keyword (`serif`, `sans-serif`, `monospace`).
- `app/globals.css:114-116`: `@theme`'s `--font-serif`/`--font-sans`/
  `--font-mono` (the real Tailwind keys) reference `var(--serif)` /
  `var(--sans)` / `var(--mono)`.

Blast radius: every `font-serif`/`font-sans`/`font-mono` utility on the
site, not just the menu. The visual result is unchanged in the common case —
next/font's own generated fallback face is locally available and resolves
before the browser ever reaches the newly-appended generic keyword — so this
is a correctness fix for a real but rare failure mode (both the primary face
and next/font's fallback unavailable), not an observable redesign. All three
families were fixed together, not serif alone, because it's one defect
(a naming collision plus an unrecognised theme key) with three structurally
identical instances in the same two files — fixing only serif would leave
sans and mono independently broken by the identical mechanism, including
mono, which F7's own round 1 had just added to the menu's group headings and
feature-rail meta line.

### `<span>` → `<h3>` for group headings — a deliberate ruling, not drift

The artifact's own markup renders every group heading as `<p class="dd-head">`
— a plain paragraph, not a heading element, at every breakpoint. F7 renders
them as real `<h3>` instead (wrapping the existing `<Link>` when
`headingHref` is set, one level above the feature rail's pre-existing
`<h4>`). This is a genuine fork between two sources of truth: the approved
artifact (source of truth for *visual* decisions per
`docs/rules/no-invention.md`) uses `<p>`; WAI-ARIA APG's guidance for a
labelled group of navigation links (its Navigation Landmark pattern) calls
for a real heading element, which nothing in this panel provided before F7.

The ruling: element *semantics* is not a visual decision under
`docs/rules/no-invention.md` — the rendered pixels are unchanged (`<h3>`
receives the identical `.dd-head` typography as the artifact's `<p>` would
have). The fork was surfaced to the team lead rather than resolved
unilaterally; see
`.agent/memory/scratch/research-megamenu-heading-locator.md` for the full
accessibility research and the options considered. A useful side effect:
`role="heading"` can never collide with a leaf `role="link"`, which closed a
pre-existing Playwright locator collision (`getByText('Programme')` matched
both the "Programme" column heading and its own "Programme" leaf link)
structurally rather than by narrowing a query.

### Why the tests are shaped the way they are (continued from above)

Same lesson as F1-F5's suite, applied to visual properties instead of
reachability:

- Every F7 assertion reads **real computed style or real bounding boxes**
  from an opened flyout via Playwright — never a source-string grep. A grep
  for the literal `"border-l"` or the absence of `"shadow-float"` would
  prove a substring changed, not that a border renders between two real,
  positioned columns, or that the replacement shadow is the artifact's
  shadow rather than none at all.
- **Codex GPT-5.5 (high effort) found three assertions in the first draft of
  this spec that were satisfiable without the property they claimed to
  prove**, the project's own audited defect class: a `count()` guard that
  passed even when the element was entirely absent from the DOM, a
  box-shadow assertion that matched three independent substrings rather
  than the shadow's real shape, and a "natural flow" test for the feature
  rail that only measured a single gap rather than ruling out `flex` +
  `justify-between` directly. All three were rewritten before this feature
  closed.
- **@qa separately found a real regression no assertion covered.** @dev's
  fix for the grid track ratios (A4) collaterally dropped `px-8` from the
  same className string it edited, even though the golden's own
  `notInScope` field explicitly named that wrapper as untouched. At a
  1280px viewport (an ordinary laptop, and `--container-max`) the sheet's
  content rendered flush against the browser edge — invisible at the spec's
  other fixed 1440px viewport, where `mx-auto`'s leftover slack around the
  1280px-capped grid happens to look like padding but collapses to zero at
  ≤1280px. Assertion **A9** was added specifically to catch this, at a
  1280px viewport, measuring real horizontal inset from the panel edge.
  A9's *first draft* asserted a DOM structure rather than the visual
  property and rejected a valid fix as a result — it was corrected to
  measure the actual computed inset before landing.

The throughline across every one of these: **an assertion must constrain
the property, not the shape of the implementation, and must be watched
failing against the broken tree before it's trusted.** A spec that never
demonstrably fails against the bug it claims to catch hasn't proven
anything yet.

### Known limitations — stated, not buried

- `contracts/checks/menu-system-layout4-shared/check-style-values-sourced.mjs`
  accepts a golden-declared `fontSizePx` value (e.g. the lead link's 23px)
  as sourced once the golden's own `source` field is non-empty and mentions
  "artifact". It verifies **a citation exists and names the artifact** — it
  does not verify the citation is *true* against the live artifact HTML. A
  fabricated value with a plausible-looking citation would currently pass.
  Closing that gap would require the checker (or a sibling) to fetch and
  diff the published artifact on every run; not implemented.
- `--shadow-sheet` is self-referential by name: `:root` defines it as a
  literal (`app/globals.css:83-84`), and `@theme` re-declares
  `--shadow-sheet: var(--shadow-sheet)` (`app/globals.css:112`) referencing
  that same name. It resolves correctly today, verified by measuring the
  real computed style — the `:root` literal is already in the cascade
  before `@theme`'s own custom-property emission resolves the reference, so
  it isn't a true circular reference in practice. It *is* order-fragile: a
  future reorder of these two declarations, or a change in how Tailwind
  emits `@theme` custom properties relative to `:root`, could silently
  resolve the reference to `unset` instead, dropping the sheet's shadow to
  none with no compile-time signal — only A1 (the real computed-style
  assertion) would catch it, and only if it happens to run. Recorded as a
  note for future editors of that block, not fixed here; the safer pattern
  (give the `:root` literal a distinct name the `@theme` key references,
  rather than referencing itself) is a candidate for a future cleanup, not
  F7's scope.
- `components/chrome/MobileMenu.tsx` was deliberately left untouched. The
  artifact's mobile treatment (`.msub__head`, inline feature-panel styling)
  differs structurally from every desktop value cited above — a future
  feature needs its own pass against the artifact's mobile markup, not a
  reuse of this file's desktop values.
- Two items recorded, not fixed, per the team lead's instruction: the
  panel's `role="menu"` contradicts WAI-ARIA APG's Disclosure Navigation
  guidance, which recommends against the menu role for ordinary site
  navigation ("No ARIA is better than Bad ARIA") — changing it touches the
  disclosure keyboard-interaction contract and is a bigger surface than a
  visual-fidelity feature. And nothing in `nav-config.ts`'s shape
  structurally prevents a *future* leaf label from being renamed to match
  its own column's heading again — the `<h3>`/`<h4>` promotion closes
  today's two known instances (Programme, Tickets) by construction, but a
  third could still coincide in a way that only breaks a future
  text-based (not role-based) query.
