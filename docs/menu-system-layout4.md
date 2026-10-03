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

## F9 — the M1 gate's own checker was reading a retired F8 field (2026-09-14)

F8 (M2, earlier in this mission) replaced `featureRail`'s shape from the F7-era
`{blurb, ctaLabel, ctaHref}` to `{heading, destinations: [{id, label, href,
variant}]}` (`components/chrome/nav-config.ts:266-283`). Nothing downstream of
that rename was touched at the time, and one gate consumer was left reading
the retired field: `contracts/checks/menu-system-layout4-f1/check-nav-hrefs-golden.mjs`'s
`flattenNavHrefs()` still read `item.featureRail.ctaHref` — a property that no
longer exists on the F8 shape. `hrefs.add(undefined)` inserted the literal
value `undefined` into the live href set on every run, which the golden diff
reported as `+ undefined` against `goldens/f1-nav-hrefs.json`, failing the
M1 gate's assertion A2 on a nav tree that was otherwise correct.

The fix touched test infrastructure only. `flattenNavHrefs()` now loops over
`featureRail.destinations[]` and collects each entry's `.href`:

```js
if (item.featureRail) {
  for (const dest of item.featureRail.destinations) hrefs.add(dest.href);
}
```

`components/chrome/nav-config.ts` needed zero changes — contract-f9.yaml's A5
enforces this directly (`git diff --quiet HEAD -- components/chrome/nav-config.ts`),
confirming the live NAV tree was never the bug.

Fixing the read exposed a second, independent gap: because the old checker
never walked `destinations[]` at all, it had never validated the feature
rail's two secondary destinations — `/tickets/day-visitor` and
`/tickets/weekend-pass` — against anything, even though both are real,
header-reachable routes (`app/(marketing)/tickets/[slug]/page.tsx`). Both
hrefs were added to `goldens/f1-nav-hrefs.json`'s `expectedHrefs`, and
`expectedHrefCount` moved from 23 to 25. The golden's `countNote` field spells
out the new total's composition, including the dedupe rule inherited from the
F7-era golden (the feature rail's primary destination shares an href with its
`theShow.links` entry and is counted once).

Full detail and every assertion: `.agent/memory/project/specs/menu-system-layout4/contract-f9.yaml`.

## F10 — Codex's cross-model review of F9 caught a fixture regression F9 didn't scope (2026-09-14)

The mandatory Codex GPT-5.5 pass against F9's diff (see `.claude/rules/workflow.md`)
found a real regression outside F9's own contract: the F1 negative-fixture
suite's positive control,
`.agent/memory/project/specs/menu-system-layout4/goldens/fixtures/f1-negative-fixtures/nav-config-good-control.mjs`,
still carried the retired F7 `featureRail` shape. Once F9 changed the checker
to loop over `.destinations`, running it against this fixture threw
`TypeError: item.featureRail.destinations is not iterable`.

That crash didn't stay contained to the one fixture. The four real negative
fixtures in the same directory (`nav-config-dead-link-not-fixed.mjs`,
`nav-config-invented-descriptor.mjs`, `nav-config-missing-sponsors-href.mjs`,
`nav-config-tickets-back-in-top-row.mjs`) each `structuredClone()` the
good-control fixture and inject exactly one targeted defect of their own —
none of the four touches `featureRail`. All four would have inherited the
stale shape and hit the identical `TypeError`, masking the one real defect
each fixture exists to prove, rather than failing for the reason its name
claims.

The fix (contract-f10.yaml) replaced good-control.mjs's `featureRail` block
with the real F8 shape, transcribed directly from
`components/chrome/nav-config.ts:266-281` — `{heading, destinations: [...]}`
with all three real hrefs (`/national-show/tickets`, `/tickets/day-visitor`,
`/tickets/weekend-pass`), dropping the retired `meta`, `blurb`, `ctaLabel`,
and `ctaHref` fields entirely. Nothing else changed: the checker itself, the
real nav config, and both golden files were left untouched (contract-f10.yaml
A6), and all four negative fixtures were re-run to confirm each still fails
for its own single injected defect, not the shape mismatch (A5).

**Deliberate non-fix, recorded as a decision, not an oversight:** the Codex
review also asked whether `flattenNavHrefs()` should defensively guard against
a missing or non-iterable `destinations`. The architect's answer is no.
`NavMegaFeatureRail.destinations` (`components/chrome/nav-config.ts:102-108`)
is a required TypeScript field — production `nav-config.ts` cannot compile
with a `featureRail` missing it. The only place this shape can go stale is a
hand-authored `.mjs` fixture that bypasses the type checker by construction,
which is exactly what happened here. A defensive guard would silently absorb
that same drift into a quiet false pass instead of the loud, immediate crash
that surfaced this regression before it reached the gate. Per this project's
"fail fast" standard, fixture data consumed by the same suite that authors it
is not a system boundary — it's trusted internal data that must be kept in
sync, which is what F10 did.

**Standing implication for future `featureRail` changes:** any future change
to `featureRail`'s shape must update the checker's flattening logic
(`check-nav-hrefs-golden.mjs`) *and* `nav-config-good-control.mjs` in the same
change, or the negative-fixture suite silently stops testing anything real.

**Known, related, not-yet-fixed:** a sibling checker,
`contracts/checks/menu-system-layout4-shared/check-nav-links-200-gated-by-exemptions.mjs:147`,
has the identical stale `item.featureRail.ctaHref` read F9 fixed in the F1
checker. It is currently dormant — masked because the routes it would check
are among the ones skipped while National Show routes are pending exemption
— not exercised, not fixed. Tracked as an open P1 backlog item, not addressed
by F9 or F10.

Full detail and every assertion: `.agent/memory/project/specs/menu-system-layout4/contract-f10.yaml`.

## F8 — NOS logo lead block and NOS-coloured tickets rail (2026-09-11/21)

Two Brad-approved, screenshot-backed asks against the desktop mega menu,
dispatched 2026-09-11 (`.agent/memory/project/specs/menu-system-layout4/contract-f8.yaml`):

- **F8a** — the lead track's mono eyebrow ("The National Show") and serif
  heading ("19th SAOC National Orchid Show") are replaced by the NOS 2027
  vertical lockup image, rendered inside the existing lead link. The
  venue/date meta line keeps rendering below it, unchanged.
- **F8b** — the feature rail (Track 5, previously a single "Buy tickets" CTA
  in a mostly-empty grey box) becomes three real destinations — Tickets, Day
  Visitor, Weekend Pass — recoloured with the NOS brand palette, a deliberate,
  narrowly scoped exception to this project's standing "SAOC chrome
  site-wide" rule (`project_national_show_brand_architecture`). Every other
  part of the header/menu, including the rail's own structural border-left,
  stays SAOC.

Full detail — every measured value, every ruling's verbatim source, and the
complete assertion-authorship writeup summarised below — lives in
`.agent/memory/project/specs/menu-system-layout4/goldens/f8-lead-logo.json`
and `f8-tickets-rail.json`; this section is the summary for a reader who
doesn't want to open JSON.

### F8a — the lockup replaces the eyebrow and heading, not just the heading

Brad's instruction named only "the heading," but the eyebrow and heading are
one visual unit (a small mono caption directly above a serif link), and the
lockup artwork itself already carries the equivalent identity content
("NATIONAL ORCHID SHOW" / "WESTERN CAPE · 2027") — keeping the eyebrow as a
separate sibling above the image would duplicate what the artwork already
says. Both are replaced by a single `next/image`, rendered at 200×176 CSS px
inside the existing `<Link href="/national-show">` — the image is the lead
link's own clickable content, not a second anchor beside it.

The venue/date meta line (`leadMeta`) is unchanged: the lockup carries only
province and year, not the specific venue name or exact dates, so dropping it
would be a real information regression on the one thing a menu visitor is
most likely to want ("where and when"). It renders below the image via its
own `<span data-testid="mega-menu-lead-meta">` (`MegaMenu.tsx:162-168`),
completely independent of the image's own load/render path.

No background plate sits behind the artwork (NOS Design ruling R21: the
supplied files ship transparent, the production sheet's tinted preview panel
is preview-only, and re-tinting or adding a plate is forbidden regardless of
colourway). A11 walks `getComputedStyle` from the `<img>` up to the panel
(`role="menu"`, `bg-parchment`) confirming no ancestor carries an added
background-color. The full-colour vertical colourway itself is confirmed
approved on the `#f4f3ec` parchment ground directly by NOS Design (they
composited the real PNG, illustration included, against the ground colour),
not inferred from ink-hex contrast alone.

### A12 — file-integrity checks, re-grounded after the width floor was withdrawn

A12 (`contracts/checks/menu-system-layout4-f8/check-logo-source-resolution.mjs`)
originally enforced NOS Design ruling R22 — a raster lockup rendered at
200 CSS px needs a source ≥400px wide (Retina 2x density), derived from the
3272×2876px master, never from another derivative. **That width floor is now
fully removed**, not merely relaxed. NOS Design withdrew R22 in full
(commit `0a79280`, 2026-09-21): the vertical master is ~16x oversampled
against a 200px render even before any Retina multiplier, so the
serving-resolution problem the floor policed never arises when the file is
used as supplied, un-cut. Brad's own asset-handling instruction settles the
same question independently — the runtime asset is placed unmodified, with
no derivative-generation step for a density floor to police:

> "Keep the fucking branding assets as I supplied them. Don't convert edit or
> change anything. You place it on the page and that's it."

Do not re-add a width check on the strength of this history — if a
width-related concern resurfaces, it needs its own new ruling, not a revival
of R22.

**What survives, re-grounded on its own merits, never on R22:**

1. 8-byte PNG signature — wrong file type, or a non-PNG carrying the ASCII
   bytes `IHDR` at offset 12 by coincidence (arbitrary bytes would otherwise
   be read as width/height).
2. IHDR tag at offset 12 — malformed header.
3. IHDR chunk length (bytes 8–11, must equal 13) — malformed header.
4. IEND terminator (final 12 bytes) — a partially-copied or interrupted file
   transfer; everything checks 1–3 inspect lives inside the first 24 bytes,
   so a truncated copy with a well-formed header alone would otherwise pass.
5. IDAT presence — a syntactically well-formed header followed directly by
   IEND with no pixel data at all.
6. Exact-basename check (`caseSensitivityRuling`, added 2026-09-19,
   unaffected by the R22 withdrawal) — see below.

None of these police export width; they catch a bad **hand-copy** of the
master, which is exactly the operation Brad's "place it, don't process it"
policy still requires a human to perform correctly — there is no build step
downstream that would ever notice a partial or mis-cased copy either.

**Exact-basename check — why path resolution isn't evidence.** macOS/APFS is
case-insensitive but case-preserving: both shell `test -f` and Node's
`existsSync` resolve a lowercase path query against a title-cased on-disk
file and report success, while Firebase App Hosting's case-sensitive Linux
404s the same file. This is *active false confidence*, not a vacuous pass —
A10 (`test -f`, case-blind by construction) and a naive `existsSync` read
both say "present" on a mis-cased hand-copy. Only a real directory listing
(`readdirSync(dir).includes(exactBasename)`) exposes the true on-disk name.
The checker's fix has three states: no case-variant present → vacuous PASS
unchanged; a case-variant present without an exact match → FAIL, naming both
names and the rename needed; exact match → all structural checks proceed.

**A10/A12 division of labour, unchanged by the re-grounding.** A10 (`test
-f`, `required: false`) owns asset *presence* informationally — expected to
fail until Brad places the file, not meant to red the gate. A12 (`required:
true`) is deliberately vacuous-pass (exit 0) on true absence, so it can be
`required: true` from the start without red-gating ahead of the asset
landing, and fails only on a *present-but-wrong* file. A check that passed on
both absence and a bad file would prove nothing — A12's whole value is that
it distinguishes those two states, never collapsing them into the same PASS.

**Why A12 stays a gate-time file check rather than folding into A20.** A12 is
a cheap, dependency-free, direct file read that runs without booting a dev
server or a browser, and when it fails it names the *specific* defect (not a
PNG / truncated / mis-cased) rather than the single undifferentiated symptom
A20 gets (`naturalWidth` stayed at or near 0), which could mean a corrupt
file, a 404 from a wrong `src`, an optimizer failure, or a slow/flaky load —
A20 cannot distinguish these from each other, A12 can. The two stay
complementary, not redundant: A12 diagnoses the file at rest, A20 proves the
fully-wired page actually serves and decodes it.

**Accepted limitations — an honest-hand-copy threat model, no adversary.**
Deliberate scope decisions, recorded so they aren't rediscovered as
oversights. Threat model throughout: Brad honestly hand-copying a real design
export — no adversary constructing a hostile PNG.

- **Per-chunk CRCs unvalidated, image not decoded.** Pixel-data *presence* is
  checked (IDAT existing); pixel-data *validity* is not. Full validation
  needs a real PNG decoder, out of proportion for a fast, dependency-free
  gate check.
- **Declared-width forgery — closed by removal, not merely accepted.** @qa
  built genuinely zlib-deflated, structurally valid PNGs with a hand-patched
  IHDR width field disagreeing with the real (smaller) decoded image — the
  checker's raw IHDR-width read couldn't see the disagreement. Once the width
  floor is removed entirely, A12 makes no width claim at all, so there is
  nothing left for a forged width to deceive — this finding is genuinely
  closed, not re-accepted under a new name.
- **Codex's IDAT-substring finding — declined, twice, independently.**
  `buf.indexOf('IDAT')` matches that literal byte sequence anywhere in the
  file, including inside an unrelated metadata chunk. A proper chunk-table
  walker would close that specific case but not the declared-width-forgery
  gap above (now moot), which needed real zlib inflation and a
  decoded-vs-declared dimension cross-check — a materially bigger lift.
  Declined by both the team lead and @qa independently on that cost/benefit
  reasoning.

The ~120px minimum-rendered-width figure and R22's original "this explains
the NOS Site's own pixelation" premise were both retracted by NOS Design as
measurement artifacts from an upscaled evidence plate before R22 was
withdrawn in full — the NOS Site's pixelation turns out to have a different
cause (no raster logo exists there at all; see R23). The golden's
`backgroundRuling.servingResolutionRuling` carries the complete retraction-
then-withdrawal history and every verbatim ruling; this section doesn't
re-derive it.

### A20 — proving the image actually decoded, not just that markup exists

A 404'd or corrupt image still renders a syntactically correct `<img>`
element with the right `src` and the right layout box — `next/image`
reserves layout space from its `width`/`height` props regardless of whether
the bytes ever arrived or decoded. A1–A3 (element presence, `src`, alt text)
all pass on a broken image exactly as readily as on a working one — this
project's own audited "assertion satisfiable without the property it claims
to prove" defect class. A20 closes the gap the golden's
`domLoadVerificationRequirement` had bound A1–A3 to since 2026-09-19 — a
binding that was, in fact, nearly lost: F8a landed with A1–A3 shipped as
element-presence-plus-`src`-attribute only, and the gap was caught by team
lead re-inspection after the fact, not by any gate.

A20 asserts, on the live element after load, both `complete === true` **and**
`naturalWidth > 0` — `complete` alone can read true on a failed load in some
browsers, and `naturalWidth` alone can transiently read 0 while a real image
is still in flight, so neither is sufficient alone. It also asserts a floor
of `naturalWidth >= 200` — the render spec's own requested CSS width, not the
source master's 3272px and not any specific `next/image` srcset-derivative
width (which breakpoint the optimizer snaps to was never independently
confirmed, so it isn't asserted as fact).

**The `>= 200` floor is load-bearing, not redundant with `naturalWidth > 0`.**
@qa's adversarial pass proved this directly: a genuinely valid, fully
decodable 10×10 PNG swapped in at the expected `src` measures `complete:
true, naturalWidth: 10` — it clears `naturalWidth > 0` cleanly and is caught
*only* by the floor. A placeholder/favicon-swap defect (small, valid,
correctly-decoding image at the right path) would pass every other assertion
in the file and this test's own `complete && naturalWidth > 0` check; only
the floor catches it.

A Codex finding calling the floor redundant with the preceding check was
**declined on the record** — do not delete the floor as dead weight:
(1) Codex's framing refuted a stronger claim than A20 makes — A20 never
claims to prove a "correctly rendered 200px source," only that a real image
decoded above a floor; (2) the redundancy claim is empirically false per
@qa's 10×10 PNG measurement; (3) Codex's own justification ("CSS can upscale
a smaller legitimate source") describes exactly the visibly-degraded-source
defect the floor exists to catch, not a reason to remove it. Across three
Codex passes on this spec file the findings went 3 real → 1 real → 1
declined — read as convergence, not as license to keep re-running passes
until one comes back clean; no fourth pass was run chasing an unqualified
PASS. **This file's Codex verdict stands at FAIL with this one finding
declined on record** — the same honest, not-laundered-into-clean treatment
given to A12's declined findings above.

A20 closes what A12 structurally cannot: (1) wrong-directory placement — a
file at any path other than the expected one 404s and `naturalWidth` stays 0;
(2) a mis-cased filename that somehow slipped past the local case check —
belt-and-suspenders in production; (3) a truncated/corrupt file that happens
to pass A12's structural read; (4) the declared-width-forgery class — a
forged IHDR width still decodes to its real, different dimensions in a real
browser, so `naturalWidth` disagrees with any declared width even though
A12's raw header read never saw the disagreement.

### F8b — the tickets rail, NOS palette as a scoped exception

The rail's data shape changed from a single `{blurb, ctaLabel, ctaHref}` CTA
to `{heading, destinations: NavMegaFeatureRailDestination[]}`
(`components/chrome/nav-config.ts`), with exactly three entries: Tickets
(primary), Day Visitor (secondary), Weekend Pass (secondary) — all three
hrefs verified live (HTTP 200) at contract-authoring time. The old blurb
copy is removed; the three rows occupy the space it left, closing Brad's
"large amount of unused vertical space" complaint directly.

Four new `--color-nos-*` tokens are registered in `app/globals.css`'s
existing `@theme` block (not a new block — F7's own A7 already found a token
declared outside `@theme` resolves to nothing usable as a Tailwind class):
`--color-nos-royal-purple` (#211A57), `--color-nos-purple-700` (#33296F,
primary-row hover), `--color-nos-pale-gold` (#F3F2D6), and
`--color-nos-olive-700` (#6A6829, rail meta line). A5/A6 read real
`getComputedStyle`, not a source grep — the primary row resolves to
royal-purple fill / pale-gold text (hover: purple-700), the two secondary
rows are ghost-styled (transparent fill, 1.5px royal-purple border,
royal-purple text), colour-for-colour against the approved artifact's own
`.btn-primary`/`.btn-ghost` rules.

**Scope boundary — this is the one exception, and it's fenced.** A7 confirms
the rail's own background resolves to NOS pale-gold while its structural
border-left — the same divider every non-lead track carries — stays
`--rule-soft` (SAOC), unchanged: a border that's part of the shared
five-track grid system is left alone, only the rail's own content colours
move. A8 walks every element in the open panel that is *not* a rail
descendant, plus the trigger button, and asserts none of the four registered
NOS hex values appear on any of their background/text/border-color
properties — a genuine exhaustive negative, not a hand-picked subset. A9
confirms `MegaMenu.tsx` and `nav-config.ts` carry zero NOS hex literals after
F8 — the four values live only in `app/globals.css`'s `@theme` block, never
inline or as arbitrary Tailwind syntax in the chrome components themselves.

**The duplicate "Tickets" link is intentional, not a defect.** The rail's new
primary row (label "Tickets", href `/national-show/tickets`) is
byte-identical in label and href to the pre-existing "The Show" group's own
Tickets leaf in the lead block. Ruled intentional: a quick-nav leaf and a
prominent rail CTA are two different affordances in two different visual
regions serving the same destination — the same pattern as a "Home" link
appearing in both a header and a footer, not a WCAG 2.4.4 violation (which
concerns a link's own context failing to disambiguate *its own* destination,
not two distinct links intentionally sharing one). Every rail-scoped link
lookup in the e2e spec is scoped through a `getRail(panel)` helper rather
than an unscoped `getByRole('link', {name: 'Tickets'})`, which would
otherwise hit a Playwright strict-mode violation (2 matches).

### The assertion-authorship finding — six instances, one feature, one QA pass

Six separate instances of this project's audited "assertion satisfiable
without the property it claims to prove" defect class surfaced within this
single feature's own QA pass — recorded once, properly, in
`f8-tickets-rail.json`'s `specFileAssertionAuthorshipFinding`, rather than as
six separate incident notes:

- **A12** — the 400px/200px source-resolution floor (now removed) was two
  independent literal arguments with no code-level expression tying one to
  the other.
- **A1–A3 / A20** — `domLoadVerificationRequirement` was written as a binding
  requirement on A1–A3 before F8a existed; F8a landed and A1–A3 shipped
  without it, caught by re-inspection, not a gate.
- **A3** — "venue/date meta line still renders below the logo" built a
  `leadTrack` locator, never used it (a bare `void leadTrack;` to silence the
  lint), and asserted an unrelated element's position instead.
- **A7** — "meta line is NOS olive-700" used an unscoped `rail.locator('span')`
  selector broad enough to miss its own target and narrow enough that its
  `if (count > 0)` guard silently never ran.
- **A8** — "no NOS colour appears anywhere outside the tickets rail" checked
  three hand-picked elements against one of four registered NOS colours.
- **A4** — "renders exactly three destination links" asserted three named
  links' hrefs and never measured the rail's total link count, so a fourth
  link would have passed.

Each of the six had a test *title* stating a specific, checkable property,
and a test *body* written to make Playwright report green without anyone
checking that the body's assertions actually entailed the title's claim. The
finding's own conclusion, stated plainly rather than softened: the only thing
that caught any of these six, across every mechanism, was a reader — human
or model — asking whether the body proves the title. Three were found by
Codex's cross-model pass (A7, A8, A4), three by direct human re-inspection
(A12, A1–A3/A20, A3). Zero were caught by any contract gate, lint, or
automatic check. This is the direct, concrete argument recorded for why the
mandatory Codex GPT-5.5 pass (`.claude/rules/workflow.md`) is load-bearing
infrastructure for this defect class, not a ceremonial second opinion — on
this file's own evidence, skipping that pass would have let three of six
real, title-contradicting defects ship.

All six fixes were verified adversarially, not just re-read: @qa's round-2
pass (`.agent/memory/scratch/qa-report-menu-system-layout4-f8.md`) injected a
real breakage for each rewritten assertion against the live running app (an
emptied meta span, a planted NOS colour on an out-of-rail heading, a genuine
fourth rail link, five hand-built PNG fixtures for A12) and confirmed every
rewrite fails under its own claimed regression, not merely that it reads
correctly.

### Verification state — accurate, not laundered into a clean story

11 e2e tests in `e2e/mega-menu-f8-logo-and-tickets-rail.spec.ts` pass. @qa's
round-2 verdict is **PASS**, with every rewrite proven to fail under real,
injected breakage. Codex's verdict on this spec file stands at **FAIL, with
one finding (the A20 floor) declined on record** — not a clean pass being
reported as one; a future reader re-running Codex and seeing FAIL should find
that result already documented above, not a discrepancy to chase down.

## F11 — M3 gate hardening: closing the seven-property audit gaps (2026-09-28)

@analyst audited the mission's own seven gate properties (section 6 above)
against what the test suite actually measured, now that all six NOS routes
had landed on `main` (`736db97d`). Five of the seven had a real, named gap;
two already passed for real. F11 closes the five, re-confirms the two live,
corrects the mission-frontmatter bookkeeping (F6–F10 had landed as real,
committed contracts but the mission file never advanced past M2/F4), and
declares the verification triad. It touches zero production chrome code —
`components/chrome/MegaMenu.tsx`, `MobileMenu.tsx`, `Header.tsx`, and
`nav-config.ts` are unchanged (contract-f11.yaml's A16 enforces this with
`git diff --quiet` on those four paths). Every fix here is test
infrastructure, gate bookkeeping, or documentation accuracy.

| Property | What the gate proves now | Checker / spec |
| --- | --- | --- |
| 1. No 404 reachable from the header | `f1-pending-nos-routes.json` is empty, so the property is measured for real rather than reporting UNMEASURED; the checker's stale F7 field read is fixed and it now catches the tickets-rail soft-404 case too (see below) | `check-nav-links-200-gated-by-exemptions.mjs`, `check-manifest-routes-have-pages.mjs`, `check-pending-routes-still-pending.mjs` |
| 2. `/national-show` reachable from the header | Already passed; re-confirmed live rather than silently dropped from this contract's coverage | `check-nav-hrefs-golden.mjs`, A7 |
| 3. No unsourced visual value | Docstring narrowed to state the checker's real scan scope (the four chrome component files only) and cites the ruled F8 exception for `app/globals.css`'s `--nos-*` custom properties, rather than implying it scans everything | `check-no-nos-palette-mixing.mjs`, A8/A8b (no scan-scope or behaviour change) |
| 4. Keyboard | Extended to check a visible focus ring on every focusable leaf in DOM order (not just the first), and to assert the panel is not a focus trap | `e2e/nav-keyboard-operable.spec.ts`, A9/A9b/A10 |
| 5. 390px drawer, no horizontal scroll | New measurement taken with the mobile drawer actually open (and National Show expanded), not just on the collapsed homepage | `e2e/no-horizontal-overflow-drawer-open.spec.ts`, A11/A12 |
| 6. Descriptors are sourced | Already passed 16/16; re-confirmed live | `check-descriptor-provenance.mjs`, A13 |
| 7. Nothing unmeasured reports as passing | Two sub-fixes: the skip-exit-code mismatch between this mission's checkers (exit 3) and `execution/contract.py`'s `kind: shell` convention (exit 77) is worked around per-assertion, not patched in the harness; the mission frontmatter now records F6–F10 as landed | A14 (remap), A15 (frontmatter), `.agent/memory/project/missions/2026-09-10-menu-system-layout4.md` |

### The property-1 checker was blind to a real soft-404

`app/(marketing)/tickets/[slug]/page.tsx` calls `notFound()` (line 91) for an
unknown slug, but by then Next 16's streaming SSR has already committed
HTTP 200 to the wire — `loading.tsx` streams before `notFound()` resolves
deep in the tree, so the status code can never retroactively become 404.
Confirmed live, both locally and on `https://beta.saoc.co.za`, against an
unknown `/tickets/` slug: HTTP 200, no `<h1>`, and the response body carries
`<meta name="robots" content="noindex"/>`. That meta tag is a
Next-16-guaranteed signal, not an SAOC convention — `notFound()`'s own doc
comment states it inserts exactly this tag, and
`HTTPAccessFallbackErrorBoundary.render()` wraps the not-found render in it
unconditionally, regardless of what status code already shipped. A grep of
`app/`, `lib/`, and `components/` for `noindex` returns zero matches, so its
presence is a reliable framework-level signal, never an SAOC-authored false
positive; a sweep of all 25 real NAV hrefs (both localhost and
beta.saoc.co.za) found it on none of them.

The not-found page's own copy ("This orchid has left the bench") was ruled
out as the signal instead — it's embedded in every page's RSC flight
payload, not only actual 404s, confirmed by grepping real, non-404 page
responses for it.

`check-nav-links-200-gated-by-exemptions.mjs`'s HTTP loop now checks
`status === 200 && !softNotFound`, where `softNotFound` is only ever
evaluated when the status genuinely is 200 (so a real hard 404's own
`noindex` tag, if it happens to carry one, never gets mislabelled
`soft-404`). Two negative fixtures exercise the two branches independently:
`goldens/fixtures/f1-negative-fixtures/nav-config-ticket-rail-404.mjs`
points at `/national-show/does-not-exist-fixture-only-404` (a genuine
router-level 404 — `/national-show` has no dynamic segment under it) to
prove the plain status-code branch, and
`nav-config-tickets-soft-404.mjs` points at an unknown `/tickets/` slug to
prove the soft-404 branch. @qa mutation-tested the status branch: a
sandboxed copy of the checker with the status term dropped from `ok`
(`ok = !softNotFound` instead of `ok = status === 200 && !softNotFound`)
wrongly passes the hard-404 fixture, while the real checker correctly fails
it — confirming the fixture and assertion genuinely depend on the status
check, not merely coincide with it.

This is a gate-detection fix only. The app-side soft-404 itself (`loading.tsx`
streaming ahead of `notFound()` resolving) is a separate, already-tracked P2
backlog item in a route this mission does not own, and is not fixed here.

### Every-leaf focus test now iterates DOM position, not href string

`e2e/nav-keyboard-operable.spec.ts` previously resolved each expected href
via `panel.locator('a[href="${href}"]').first()`. `/national-show/tickets`
appears twice in the rendered panel — once as the "The Show" group's own
Tickets leaf, once as the F8 feature rail's primary CTA (the ruled
duplication documented in the F8 section above) — so the href-keyed lookup
resolved both loop iterations to the same DOM node, and the feature rail's
own CTA anchor was never independently focus-tested. The test now locates
every `a[href]` inside the panel, asserts the count matches the expected
href list (duplicates included), and walks the panel's links by DOM
position instead, so both occurrences of the duplicated href get their own
`.focus()` + `getComputedStyle` check.

### The `--nav-file` flag is test-only

`check-nav-links-200-gated-by-exemptions.mjs` takes an optional `--nav-file
<path>` argument, mirroring `check-manifest-routes-have-pages.mjs`'s own
`--manifest-file` escape hatch. It exists so a negative fixture can swap in
a broken nav tree and prove the checker's HTTP branch actually fails on it —
never for a real gate run.

### Two open items, neither resolved by this feature

- **Skip-exit-code mismatch.** This mission's shared checkers (built against
  `contracts/checks/_shared/run_contract_suite.mjs`'s convention) exit 3 to
  signal skip; `execution/contract.py`'s `kind: shell` assertions treat exit
  77 as the reserved skip code. `execution/` is harness-owned
  (`.agent/update-manifest.yaml`), so F11 does not patch it — instead, every
  new assertion that can hit the 3-exit-code skip path remaps it to 77 in
  the assertion's own shell command. The systemic fix (standardising the
  exit code, or teaching `contract.py` to recognise 3 as well) is recorded
  in `.agent/memory/project/backlog.md` as an Athanor upstream item.
- **Verification-triad preflight.** `execution/contract.py`'s
  `_run_triad_coverage_preflight()` runs unconditionally before any
  assertion phase and hard-blocks a contract missing a declared triad kind
  unless it's grandfathered in `execution/triad-baseline-exempt.txt`.
  `contract-f11.yaml` is not in that file. It declares `codex_qa` (A17,
  passed on the final diff) and `browser_deployed_check` (A18, against
  `https://beta.saoc.co.za`, pending until deploy), but deliberately does
  not declare `gws_inbox_check` — this feature sends no email and touches
  no email-adjacent code, the same precedent already on record for the
  `nos-design-system` mission's M7/M8 contracts. Until a baseline entry is
  added (harness-owned, out of this feature's scope) or Brad rules on the
  exemption, an actual `execution/mission.py gate --milestone M3` run would
  hard-block on this contract before evaluating any of its assertions. This
  is recorded as an open, currently-live gate blocker, not resolved here.

Full detail and every assertion:
`.agent/memory/project/specs/menu-system-layout4/contract-f11.yaml`.
