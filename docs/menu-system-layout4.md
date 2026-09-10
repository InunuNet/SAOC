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
