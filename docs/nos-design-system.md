# NOS design system — how the show gets its own look inside the SAOC site

This document is for whoever next touches `app/(marketing)/national-show/**`, or wonders
why `/national-show` looks different from the rest of the site. It explains the
**mechanism** the scoping relies on and the traps that already broke it three times
during the `nos-design-system` mission (2026-09-06/07). It is not a feature tour — the
routes and components are the code; read this for the "why" that the code doesn't say
out loud.

## 1. The scoping seam

`/national-show/*` pages render inside the same `app/(marketing)/layout.tsx` as every
other marketing page — below `UtilityBar` + `Header`, above `Footer`. Nothing about that
tree changed. The show gets its own visual identity through one addition:
`app/(marketing)/national-show/layout.tsx` wraps its children in a single
`<div className="nos-theme ...">`, and `app/(marketing)/national-show/nos-theme.css`
(imported by that layout) redeclares the **existing SAOC semantic custom-property
names** — `--bg`, `--fg`, `--accent`, `--link`, `--parchment`, `--primary`, etc., the
same names `app/globals.css` declares on `:root` — on the `.nos-theme` class only.

Nothing is renamed. No component is forked. The whole mechanism is one deletable
wrapper.

`:root` and Tailwind's `@theme` block in `app/globals.css` are **never touched** —
verified by a contract assertion that `app/globals.css` stays byte-identical to
`origin/main`. `@theme` is global in Tailwind v4; editing it would leak show tokens onto
every SAOC page.

**Consequence:** SAOC-owned shared components — `components/vendors/*`,
`components/ui/PageHero.tsx`, the shared ticket pages under `components/tickets/*` —
re-skin under `.nos-theme` with **zero edits to any of their files**. **Verified
2026-09-08:** zero SAOC-colour leaks sampled across the national-show routes, and
`/about` renders unchanged. Not re-checked since.

Fonts follow the same seam: `national-show/layout.tsx` loads Cormorant Garamond and Jost
via `next/font/google`, binds them to `--font-nos-cormorant` / `--font-nos-jost` on the
same `.nos-theme` element, and `app/layout.tsx` is never touched.

## 2. The trap that cost three defects — read this before changing a token

A CSS custom property's `var()` reference is substituted **at the element that declares
the property**, not at the element that uses it.

`app/globals.css`'s `@theme` block declares things like `--color-primary: var(--primary)`
on `:root`. That `var(--primary)` resolves *there*, against the SAOC palette, and the
already-resolved SAOC literal is what inherits down into `.nos-theme`. Redeclaring
`--primary` on `.nos-theme` does nothing to that inheritance — it cannot retroactively
re-run a `:root` declaration.

The working rule: **redeclare the exact name the consumer's CSS actually reads.**

- Tailwind colour utilities (`bg-parchment`, `text-ink`, …) emit `var(--color-*)` — so
  `nos-theme.css` must redeclare `--color-primary`, `--color-parchment`, etc. directly as
  literals, in addition to the raw semantic names (`--primary`, `--parchment`). Declaring
  only the raw names is inert for anything styled with a Tailwind colour utility.
- Hand-written element styles in `app/globals.css` (e.g. `.h1`) read the semantic names
  directly (`--fg`, `--bg`), so those need redeclaring too.

The same trap applies to **inherited properties**, not just custom properties. `body` in
`app/globals.css` already resolves `color: var(--fg)`, `background-color: var(--bg)` and
`font-family: var(--sans)` — outside `.nos-theme` — so those three concrete CSS
properties must be re-declared again on `.nos-theme` itself. Before that fix, **118
elements rendered SAOC ink on SAOC parchment while `.nos-theme`'s own `--fg`/`--bg`
custom properties were completely correct and completely inert** — because nothing was
reading them. A check that only sampled utility-classed elements would have missed this
entirely; QA's fix was to sample an unstyled `<p>` with no class attribute on every
national-show route via Playwright computed style.

**Fonts escaped this trap by naming luck, not by a different mechanism.** Tailwind v4's
font namespace is literally `--font-*`, so `.font-serif` emits `font-family:
var(--font-serif)` directly — the same name `next/font` publishes and `nos-theme.css`
redeclares, with no intermediate hop to resolve early at `:root`. Do not generalise this:
`--font-family-serif` (the name in `globals.css`'s `@theme` block) maps to no Tailwind
utility and is inert; nothing reads it.

One more thing worth stating plainly because it was gotten wrong once: an earlier
diagnosis blamed this on "build-time const-folding." That explanation is **wrong** — the
emitted CSS keeps every indirection; the bug is inheritance-order at runtime, not
compile-time inlining. The wrong explanation matters because it implies the problem is
unfixable at the CSS layer; it isn't.

See `app/(marketing)/national-show/nos-theme.css` — its header comment carries this
mechanism explanation in full, and every colour it declares is one of two things: a raw
NOS palette value, or that same value redeclared under the `--color-*` Tailwind name.

## 3. A green gate is a measurement, not a standing guarantee

Every verified claim in this document is dated at the point it's made — a check that
proved something true on a given day, not a standing property of the code. None of it
re-runs automatically on a later change, so treat each dated claim as exactly that:
true when measured, unknown since.

**Verified 2026-09-07:** Codex GPT-5.5 adversarial review of the branch diff via
`execution/codex_qa.sh`, exit 0 (PASS). Transcript at
`.agent/evidence/nos-design/codex/codex-qa-2026-09-07.log` (4,098 lines, ending
`PASS`/`EXIT=0`) — cited so the next reader can check it rather than trust it. Not
re-run since. The run itself happened a day earlier than it was committed: it was
executed in a session scratchpad on 2026-09-07 and only written to this durable path on
2026-09-08 (commit `8487582f`), after an earlier draft of this document searched
`learned.md`, `backlog.md` and the commit log, found no record of it, and correctly
dropped the claim rather than assert something unverifiable. The claim was true the
whole time; it just wasn't checkable by anyone until the transcript was committed. A
result that exists only in a session's working memory is not evidence — the same
standard this document holds every other claim to.

Nothing in this repo's CI wires those checks in. `.github/workflows/ci.yml` runs lint,
type-check, build, and two residue guards (`dataset-residue-guard`,
`firestore-residue-guard`) — nothing else. `package.json` has no `test` script. A repo
search for the contract-check tooling (`contracts/`, `execution/contract.py`,
`execution/checks/`) turns up plenty of files, but none of them are invoked from
`ci.yml` or from any `Makefile` target that CI calls — `make contract-check` and `make
gate-all` exist, but only run when a person or an agent runs them by hand. Every
assertion in a `contract.yaml` runs exactly once, when its author invokes it, and never
again on its own.

The consequence: someone can regress the `.nos-theme` scoping seam, reintroduce olive as
body text on pale gold, or ship a fabricated Event date next week, and no automated
check will notice. **If you change anything in this system — the token layer, the
contrast-sensitive surfaces, the SEO wiring — re-run the measurements yourself. Do not
rely on the results recorded in this document.** The methods are described where the
claim is made: composited-pixel contrast measurement (§4), sampling an unstyled
paragraph rather than only utility-classed elements (§2, §4), and reading served HTML
from a real running server rather than grepping source (§7, §8's whitespace-bug note).

Two related facts, so a future CI runner doesn't misread the suite:

- **Seven of the nine Playwright check scripts named by the M5/M6 contracts do not exist
  on disk.** Only `execution/checks/verify_admin_nav.ts` and
  `verify_admin_nav_active_state.ts` are present; `verify_admin_ia.ts`,
  `verify_admin_status_vocabulary.ts`, `verify_tickets_front_door.ts`,
  `verify_show_seo.ts`, `verify_social_artboards.ts`, `verify_event_jsonld_guard.py` and
  `verify_cleared_images_only.py` are missing. The assertions that name them could never
  have run as written, by anyone. A future runner needs to distinguish "ran and failed"
  from "was never runnable" — those are different signals, and treating a missing script
  as a pass (or as a fail) would both be wrong.
- **The triad exemption for this contract is fragile by design.** `gws_inbox_check` is
  grandfathered in only while the contract file stays **unedited** since it was
  baselined. Any future edit to it forfeits that pin and forces re-baselining against
  whatever verification kinds are missing at that point — an otherwise-innocuous
  contract tweak can trip a gate block for a reason that has nothing to do with the
  change itself.

**This isn't hypothetical for this project — it's already recurring.**
`.agent/memory/project/backlog.md` records four separate contract checks
(`vendor-f6-review-workflow`, `vendor-f5-register-route`, `vendor-f3-showcase-page`,
`vendor-f4-admission-products`) confirmed failing, pre-existing and unrelated to the
mission that found them, during an earlier vendor-flow QA sweep (2026-08-25/26) — plus a
separate, still-open standing item, "Audit remaining contracts for the weak-assertion
defect class." Those four failures are symptoms of the same cause described above:
nothing runs a contract's checks after the mission that wrote them closes, so decay sits
undetected until someone happens to look.

## 4. Contrast

Source of truth: `.agent/memory/project/specs/nos-design-system/goldens/nos-contrast.golden.md`
(WCAG 2.1 relative-luminance formula, computed by `execution/checks/nos_contrast.py`,
**computed 2026-09-07** — a static palette table, re-derivable any time from the same
hex values, but not re-run since).

**Headline rule: olive `#A7A841` is the show's most recognisable colour and its least
usable one.** Measured ratios, 2026-09-07: 6.16:1 on royal purple (passes), but **2.22:1
on pale gold** and **2.52:1 on white** — fails body text, fails large text, fails even
the non-text 3:1 bar. Olive is legal on light grounds only as a purely decorative rule
(WCAG 1.4.11 exempts decoration) — never body text on light, never a meaningful border,
never a button fill. `--olive-700` / `--olive-deep` `#6A6829`/`#7F7D33` (5.53:1 / 4.30:1
depending on ground) is the legal olive for large text on light grounds; it still fails
the 4.5:1 body-text bar.

Two methodology rules the mission earned the hard way, both worth repeating for any
future contrast check on this tree:

1. **Every colour assertion must sample an unstyled paragraph**, not only
   utility-classed elements — see the 118-element inert-token defect above. A sweep that
   only checks elements carrying a Tailwind class will pass while plain text underneath
   is silently wrong.
2. **For text over photography, measure the actual composited pixels, not a flat
   estimate.** The method: hide the text, screenshot the background, find the worst
   single pixel inside the text's own bounding box, then composite the text's real
   computed colour — **including its own alpha** — over that pixel before scoring.
   **Verified 2026-09-08:** `text-ivory/85` scores as raw ivory (correct-looking) unless
   you do this, overstating the real ratio by roughly 1.5 points.

   The same method is what caught, and the same day confirmed the fix for, a real
   defect in the hero's "Opens in" countdown label. **Found 2026-09-08:** at
   `text-ivory/45` (10px, weight 500) it measured 3.92–4.36:1 across three widths
   (390/1024/1280px) against a required 4.5:1 — a genuine WCAG failure, in the same hero
   and scrim as a wordmark that passes comfortably, because the label's own 45% opacity
   eroded an otherwise-adequate scrim. **Fixed 2026-09-08** (commit `b3adca7d`) by
   raising the opacity to `text-ivory/70`, scrim untouched; the worst composited case
   across three widths and three background images measured **7.06:1** the same day.
   The fix was confirmed with a negative control: forcing the label back to 0.45
   reproduced the original 3.84–4.22:1 failures, proving the harness actually rejects
   the broken state rather than passing regardless of input. That negative-control step
   is the technique worth reusing on the next contrast fix — a check that only ever runs
   against the "fixed" code can't tell a real pass from a check that would pass
   anything. Not re-measured since 2026-09-08.

## 5. Photography, and the failure that recurred

Only the five rights-cleared images in `public/images/` may ship as page imagery:
`orchid-dark.jpg`, `orchid-pink.jpg`, `orchid-purple.jpg`, `orchid-violet.jpg`,
`orchid-yellow.jpg`. The 13 photographs in `branding/National Show 2027/` are Scott
Ormerod's own work, watermarked, and **not rights-cleared** — never reference or ship
them from `app/` or `components/nos/`.

Treatment: full-bleed on near-black under a dark-to-transparent royal-purple scrim, text
on the dark end. **Gradient overlays only** — no duotone, filters, or vignettes; the
flower supplies the colour.

**The pattern that bit the hero repeatedly: scaling an element moves it into different
photographic ground.** Over the course of 2026-09-07, the same strapline measured
2.44:1 at one width, 3.35:1 once enlarged, and 4.78:1 at 1024px, while 390px and 1280px
both looked comfortable at 7.37:1 — the failure was invisible at the two widths a quick
check would naturally try. The rule that follows: **measure at three widths minimum,
and against the brightest image**, not the default. The page's default hero uses one of
the darker of the five images, so a visual check that only exercises the default
silently tests the easiest case.

Also worth recording as the worst instance of a styling decision carrying accessibility
weight invisibly: the hero's top scrim was **gated on a `brandMark` prop**. Removing that
prop for an unrelated layout reason silently removed a legibility guarantee from the zone
the text had moved into — nothing in the type system could catch it, because a styling
prop was load-bearing for contrast and nothing declared that dependency.

## 6. The identity

The circular badge lockup is **retired** — do not use it or reference it in new code.
The approved identity is **Layout B**: the *Disa graminifolia* emblem above a
single-line `NATIONAL ORCHID SHOW` wordmark in Cormorant Garamond at roughly 0.16em
tracking, over a wide-tracked `WESTERN CAPE · 2027` line in Jost at 0.30em.

On `/national-show`, the page's `<h1>` **is** the lockup: its `textContent` is the real
wordmark text ("National Orchid Show" / "Western Cape · 2027"), not an image with hidden
filler text, and both emblem `<img>` elements carry decorative `alt=""`. This keeps the
heading real, indexable text rather than a picture standing in for one. **Verified
2026-09-08** against real DOM at both 390 and 1280px, including that only one emblem is
visible per breakpoint by computed size, not by class name alone. Not re-checked since.

The wordmark measures 15.55em wide, so it cannot sit beside the emblem below roughly
1263px of viewport width — the inline-to-stacked layout switch happens at Tailwind's
`xl` breakpoint for exactly that reason. The emblem's width is derived from the type
scale rather than set independently, so changing the type scale moves both together; it
does not need a second manual adjustment.

## 7. SEO

The intended shape: **exactly one `Event` JSON-LD node on the whole site**, on
`/national-show`, built from Sanity-sourced values only (`nationalShow` document),
with one `Offer` per `ticketType` pointing at that product's own `/tickets/<slug>` page
(never the five-product router at `/national-show/tickets` — Google requires an offer
URL to be a page predominantly selling that specific ticket).

**If Sanity is missing `name`, `startDate`, or `location`, emit no Event node at all** —
never substitute a placeholder or the show's own dates as a stand-in for a different
event's missing date. A malformed or fabricated Event node is treated as worse than no
node.

No Event or Offer markup on the vendor flow (token-gated purchases are ineligible for
Google's Event rich result), and no Event markup on workshops/conferences (Sanity's
`ticketType` schema has no session date field to source `startDate` from — faking one to
unlock a rich result is exactly the failure this rule exists to prevent) or on archive
pages (a past edition isn't bookable; Event markup buys nothing documented and risks a
second entity competing under the same series name).

Five identifiers are dead and must never reappear in this codebase's structured data:
`subEvent`, `superEvent`, `eventAttendanceMode`, `EventCompleted`, `previousStartDate`.
They were investigated and rejected — Google's Event documentation never mentions the
first two, does not list `EventCompleted` among its four valid `eventStatus` values, and
`previousStartDate` is rescheduling-only (requires `EventRescheduled`), not a way to
link one edition to another.

Early-bird pricing uses `validThrough` on the `Offer`, not `validFrom` — a cutoff is when
an offer *stops* being valid, not when it starts.

**Found 2026-09-08 (QA pass), fixed and re-verified the same day (commit `b3adca7d`).**
The QA pass found `lib/seo.ts`'s `buildPageMetadata()` and `components/seo/JsonLd.tsx`'s
`eventJsonLd`/`nationalShowEventJsonLd` builders correctly written but called from no
file under `app/` — no canonical tags, and `/national-show`'s `og:url` resolving to the
homepage. Re-verified against served HTML the same day, after the fix:
`buildPageMetadata()` is called from all 14 `/national-show` routes; `/national-show`
serves `<link rel="canonical" href="https://saoc.co.za/national-show">` and `og:url
https://saoc.co.za/national-show`; exactly one `Event` node exists in the national-show
tree, with bare `2027-09-16`/`2027-09-19` dates, a `location` carrying both `name` and
`address`, and five `Offer`s each pointing at its own `/tickets/<slug>` page (200). A
64-route sweep the same day found zero occurrences of the five dead identifiers, a clean
61-URL sitemap with no 3xx entries, and `noindex, nofollow` served on `vendors/register`
and `vendors/payment`. Not re-verified since 2026-09-08.

Two implementation details a future dev needs, since they're not obvious from the
builder signatures alone:

- **Offer `availability` is derived from Sanity's `releasedQuantity`, not a live
  Firestore sold count.** A prerendered page is not allowed to reach `firebase-admin`
  (contract-enforced), and the route is pinned to `revalidate=60` — so live sell-through
  is not what `availability` reflects; it reflects the released allocation.
- **Offers are scoped to `ticketType`s where `category === 'admission'` and `demo` is
  false.** Workshop/conference/vendor products never enter the `Offer` array, consistent
  with §7's rule that those get no Event/Offer markup at all.

Note on the commit that shipped this: `b3adca7d`'s message describes only a structure/
docs record (the sub-nav agreement below), but the commit — pushed to this shared
branch — also contains all 17 files of this SEO wiring, from a `git add -A` run while
that work was mid-edit. History is not being rewritten on a pushed branch, so this is
recorded here rather than fixed by amending the commit.

## 8. Known gaps — recorded, not resolved

- No exhibitor data model exists in Firestore. `/admin/exhibitors` is deliberately
  declared-empty, marked `data-placeholder`, rather than showing fabricated rows.
- The VIP ticket ladder is incoherent (VIP priced below a plain Weekend Pass while
  described as strictly more product). Not a design problem — needs a pricing decision.
- Two general-enquiry addresses are live at once (`council@saoc.co.za`,
  `info@saoc.co.za`). Neither is hardcoded into new NOS code; not resolved here.
- The `<h1>` on `/national-show` does not render the editor-overridable Sanity title —
  it renders the fixed Layout B wordmark text described in §6.
- **Confirmed: a second `Event` node for the same real-world show is live**, served from
  `/events/19th-south-african-national-orchid-show` (the generic society-events route) —
  same name, same dates, same venue, different URL. So "exactly one Event node" (§7)
  holds within the national-show tree but **not site-wide**. This route is outside
  `app/(marketing)/national-show/**` and this branch never touches it; it needs a
  follow-up on the society-event route itself. This is exactly the duplicate-entity
  cannibalisation §7's design exists to prevent, so it's recorded as confirmed rather
  than as a hypothetical risk.
- Several contract check scripts referenced by the M5/M6 contracts do not exist on disk
  (`verify_admin_ia.ts`, `verify_admin_status_vocabulary.ts`,
  `verify_tickets_front_door.ts`, `verify_show_seo.ts`, `verify_social_artboards.ts`,
  `verify_event_jsonld_guard.py`, `verify_cleared_images_only.py`) — the assertions they
  back have not been run as written.
- `data-placeholder` is a load-bearing marker, not decoration — it is how the
  no-fabrication rule (§7, §8) is made checkable. Do not remove it from a field just
  because the surrounding layout looks tidier without it.
- A live JSX whitespace bug exists elsewhere in this codebase: an inline closing tag
  ending a source line drops the following space in the rendered output (`<span>x.</span>
  These` renders as `x.These`), invisibly in source. Any check of rendered copy on these
  routes must read served HTML from a real server, never grep the JSX source.

## 9. M7 — the design supersession rework

M6 shipped a NOS system with its own radii, shadows and a Jost eyebrow face — reads that
were **never approved**; Codi's relay of "NOS radii/shadow/Jost as universal" was retracted
(ruling R1, `.agent/memory/project/design/nos-design-rulings.md:36-38`). R1 settles it: NOS
is a *subsection* of saoc.co.za, not its own site, so structure stays SAOC's and only
identity (palette, display face, emblem, photography) changes. M7 (F20–F22) reverts the
grammar and repairs four hero defects the M6 build shipped alongside it. Design rulings
R1–R4 are the basis; the mission record's briefs are at
`.agent/memory/project/missions/2026-09-06-nos-design-system.md:116-134`.

### F20 — token grammar hardening

`components/nos/` reverts to the site's own structural tokens instead of the retired NOS
ones:

- **Radius.** Cards and the CycleStep "current" panel go back to square corners
  (`--radius-card`, `--radius-lg` both `0`); buttons go back to `--radius-button` (`2px`,
  the site's `--radius-1`) instead of the NOS pill radius —
  `components/nos/Button.tsx:82` no longer references `--radius-pill` at all. Pill radius
  is now confined to the eyebrow-pill sites and the CycleStep rail dot; nothing else may
  render above 4px without an explicit allowlist reason (R2).
- **Borders, not shadows.** `--shadow-card` is deleted from the stylesheet and from all
  three of its former consumers — `Card.tsx`, `CycleStep.tsx` and
  `app/(marketing)/national-show/archive/page.tsx`. `Card.tsx:16` now carries
  `border-[length:var(--border-primary)]` where it carried `shadow-[var(--shadow-card)]`;
  `CycleStep.tsx`'s current-step panel does the same. Elevation is expressed the way the
  rest of the site expresses it: a border, never a shadow (R1).
- **Type faces.** Eyebrows across the section move off Jost onto JetBrains Mono, matching
  the site's own eyebrow face (R1). Jost is not removed from the system — it stays reserved
  for the lockup's `WESTERN CAPE · 2027` location line (`components/nos/Logo.tsx`), the one
  place R1 keeps it.
- `--radius-button` is redeclared **inside** the `.nos-theme` block itself, not left to
  inherit — the mission's own `var()`-resolves-at-declaration trap (§2 above) applies to
  this token exactly as it did to colour.

Verified by a 44-id Playwright verifier,
`execution/checks/verify_nos_m7_hero_and_grammar.ts` (F20's commissioned driver — see
below), plus a set of static greps in `contract-m7.yaml` (A46–A50) confirming
`shadow-card`, `shadow-[`, `rounded-(sm|md|lg|xl|2xl)` and `radius-pill` are gone from
`components/nos/` and that the stale nos-theme.css comment claiming 2px "reads cold and was
rejected" — the retracted relay R1 corrects — has been replaced by one citing R1 itself.

### F21 — typographic h1 grammar

Ruling R3 (`nos-design-rulings.md:53-61`): *"The `<h1>` is the typographic headline. The
emblem sits above it as a modest mark."* The M6 hero used the `Logo` lockup itself as the
page's `<h1>` (a `size="hero"` scale and an `as="h1"` escape hatch on `Logo.tsx`, feeding
the emblem and wordmark into the heading element). F21 removes that path entirely:
`components/nos/Logo.tsx` drops `size` and `as` from `NosLogoProps` along with the five
hero-only sizing constants (`HERO_TITLE_SIZE`, `HERO_TITLE_CLASS`,
`HERO_EMBLEM_VERTICAL_CLASS`, `HERO_EMBLEM_HORIZONTAL_CLASS`, and the `heroStyle` custom
property) that existed only to scale the lockup up to headline size. The lockup's outer
element is a plain `<span>` now (it no longer needs to conditionally render as `<h1>`), and
is used only at its compact size in the masthead and colophon (R3's "header and footer,
where a signature is what's wanted").

In its place, `NosHero.tsx` renders a real typographic `<h1>` — the show's name as text at
`--display-xl` in Cormorant — with the emblem placed above it as a decorative mark
(`alt=""`). This is also the fix behind §6's "the page's `<h1>` **is** the lockup" note
above: that text is now backed by an actual heading element rather than an image standing
in for one.

### F22 — hero composition

Three defects in the M6 hero, all traced to ruling violations, repaired together since they
share the same hero markup:

- **Collision fixed by the crop, not the scrim (R4).** The M6 hero deepened its scrim
  locally to hide a compositional collision between the bloom and the type block — exactly
  the vignette-solving-a-layout-problem R4 forbids. F22 shifts the focal point right via
  `object-position` (declared off the real bloom centre, not a hardcoded crop, so it holds
  across viewport aspects) so the left third resolves to the frame's own naturally dark
  ground; at 390px the bloom stacks full-bleed below the type block rather than behind it.
  The three **scrim gradient layers themselves are unchanged** — verified by
  `SCRIM_UNCHANGED` against a baseline captured from the pre-M7 build (see below), because
  R4 says the scrim's only job is legibility and it must not acquire a second one.
- **Three equal-weight, 2px-radius actions, "Register interest" restored.** M6 had demoted
  the exhibitor conversion action to an underlined text link — the exact decay R2's
  corollary forbids ("an action demoted to an underlined text link has left the hierarchy").
  F22 restores it as a button alongside the other two hero actions, all three the same
  2px-radius shape and visual weight, with the focus ring re-measured now that it sits on a
  rectangle instead of a pill (R2's second corollary: "changing a button from pill to
  rectangle moves the focus ring relative to the label").
- **The `OPENS IN` eyebrow matches the countdown's own type.** Restyled off the (now
  removed) Jost eyebrow face onto the same mono type the countdown numerals themselves use,
  so the label reads as part of one instrument rather than a mismatched caption.

### The 44-id verifier

`execution/checks/verify_nos_m7_hero_and_grammar.ts` is the single Playwright driver behind
every browser-measured M7 claim — F20's token grammar, F21's heading, and F22's hero
composition all read from the same run, at 390/1024/1280px. It exists because a QA pass
raised seven candidate defects against an earlier version of this suite and all seven
turned out to be harness bugs — six of them a check reporting `FAIL` when it had actually
failed to *locate* its target. The script's status vocabulary makes that distinction
structural: `PASS` (the property holds), `FAIL` (measured, and the property does not hold),
`BLOCKED` (target or precondition missing — nothing learned), `ERROR` (the check threw).
`FAIL` and `BLOCKED`/`ERROR` are never collapsed into each other; a gate grep for `"PASS"`
still fails on any of the other three, so the distinction doesn't cost the gate anything —
it's for the human deciding whether the *code* or the *harness* is wrong
(`verify_nos_m7_hero_and_grammar.ts:26-38`).

What it checks, by group: the `<h1>` text, face, case, size and line count at all three
widths (D1); the hero's `object-position`, the bloom-clear-of-emblem measurement (an
annulus around the emblem, not a padded box that contains it — see the post-mortem below
for why that distinction mattered), the unchanged scrim, and composited contrast on the
`<h1>`, lede and eyebrow (D2); the three actions' count, radius, absence of underline,
equal weight, hrefs, and focus-ring edges/corners/clipping/outline-ness (D3); the eyebrow's
face-match and case (D4); the token-grammar greps described under F20 above; a regression
guard that the other eleven heroes are untouched; and two negative controls proving the
contrast and bloom metrics actually discriminate rather than always reporting the answer
they're pointed at. Contrast is read from composited screenshot pixels, never
`getComputedStyle().color` (Tailwind v4 serialises opacity-modified colours as `oklab()` —
InunuNet/SAOC#3). Exit codes: `0` all PASS, `1` at least one FAIL, `2` setup failure
(server never came up, Playwright missing, hero image missing), `3` no FAIL but something
BLOCKED or ERROR remains — never collapsed into a pass.

### The scrim baseline

`SCRIM_UNCHANGED` needs something from before F22 to compare against, and the M7 diff was
still uncommitted while the check was written — so a straight `git show HEAD` couldn't
supply it. It was captured from a **detached git worktree checked out at `24f87e05`** (the
M6 build, the design-supersession-docs commit that immediately precedes this mission's
uncommitted work), served locally with `next dev --webpack` on port 3921 (Turbopack refuses
a symlinked `node_modules`, which the worktree needs), and read via Playwright as the
computed `background-image` of the hero's three scrim `<div>` layers. The result is
`.agent/memory/project/specs/nos-design-system/goldens/m7/scrim-baseline.json` — three
gradient strings, DOM order. The baseline file also records that in the same capture the
M6 hero's `<h1>` was still the `Logo` lockup itself (the F21 path this milestone removed),
while the current tree's `<h1>` has no `<img>` at all — two demonstrably different trees
producing byte-identical gradients, which is exactly the property F22 claims (the scrim
keeps its stops and opacities; only the composition around it changed). If this baseline
file is ever absent, the check reports `BLOCKED`, never `PASS` — this script never
regenerates the baseline from the tree under test, because that would compare the change
against itself.

## 10. M8 — semantic status colour and focus affordance

Where M7 repaired structure, M8 (F23–F24) closes two functional gaps ruling R6/1 assumed
were already closed and weren't: status colour and focus rings had no dedicated tokens at
all. Rulings R8 (status colour) and R9 (focus) are the basis
(`nos-design-rulings.md:106-149`); the full constraint tables and measured values live in
`.agent/memory/project/specs/nos-design-system/goldens/m8/status-tokens.golden.md` and
`focus-affordance.golden.md` — this section summarises, it doesn't restate them.

### F23 — semantic status colour tokens

R6/1 said status colours were excluded from the NOS palette shift. R8 records why that
guardrail was unenforceable as written: **no status tokens existed anywhere in the
codebase** to exclude. Two public NOS routes were painting error banners with brand ink
(`border-primary-800`/`text-primary-800` in `VendorApplyForm.tsx` and
`VendorRegistrationCodeEntryForm.tsx`), and two token-gated components were painting
validation state with raw, out-of-palette Tailwind red
(`VendorMarketingFieldset.tsx`, `VendorMarketingUploadField.tsx`) — a defect only latent
because NOS and SAOC brand ink happened to read as "emphasis" rather than "error."

Six new tokens, declared inside the `.nos-theme` block of
`app/(marketing)/national-show/nos-theme.css` — never in `app/globals.css`, per R8/2's
explicit "do not open the SAOC base uninvited" (the gap is filed to the SAOC session as a
finding; when the base declares these names, the NOS block collapses to overrides with
nothing stranded):

| token | hex | measured on its own ground |
|---|---|---|
| `--status-error-on-light` | `#8f2834` | 7.95:1 on `#fbfaf0` |
| `--status-error-on-dark` | `#e298a0` | 7.51:1 on `#1a1445` |
| `--status-warning-on-light` | `#714a1e` | 7.42:1 on `#fbfaf0` |
| `--status-warning-on-dark` | `#d6a164` | 7.43:1 on `#1a1445` |
| `--status-success-on-light` | `#1f5c3e` | 7.54:1 on `#fbfaf0` |
| `--status-success-on-dark` | `#8fb89c` | 7.73:1 on `#1a1445` |

R8/3's reasoning is empirical, not aesthetic: each value collapses to roughly 2:1 on the
*opposite* ground, so a single value per state cannot clear 4.5:1 on both `#fbfaf0` (pale
gold) and `#1a1445` (royal purple) — a pair is the only shape that works.

**The on-light/on-dark pairing rule.** Each pair is generated at one hue, with lightness the
only thing that separates the two members (error and warning hold hue to within 0.5° across
their pair; success's on-dark member drifts to 139.0° against the on-light member's 150.5°,
approved by Codi rather than tightened, because "a value that satisfies the rule and looks
wrong has satisfied the wrong thing" — `status-tokens.golden.md`'s §4). The assertion
tolerance is ±15° between pair members, deliberately looser than an earlier ±4°, because the
tighter number rejected a value chosen correctly on a quantity nobody perceives.

Three **ground-resolved aliases** are what components actually consume — never the six
literals directly:

```
.nos-theme               { --status-error: var(--status-error-on-light);  … }
.nos-theme .nos-on-dark  { --status-error: var(--status-error-on-dark);   … }
```

(and the equivalent pair for `--status-warning` and `--status-success`). `.nos-on-dark` is
a marker class applied to any NOS section whose composited ground is `--primary`,
`--primary-800` or `--night`; a consumer writes `text-[var(--status-error)]`, which Tailwind
emits as a **regular property** (`color: var(--status-error)`, not a custom-property
declaration), so it resolves at the *using* element and correctly picks up whichever alias
is in scope there. This is the one place in the token system where the "`var()` resolves at
declaration, not use" trap from §2 above does **not** apply — the golden spells out why
(`status-tokens.golden.md` §2, "Why the alias indirection is safe here").

Four call sites converted off brand ink and raw Tailwind red onto `var(--status-error)`:
the two public vendor banners (`VendorApplyForm.tsx`, `VendorRegistrationCodeEntryForm.tsx`)
and the two gated ones (`VendorMarketingFieldset.tsx`, `VendorMarketingUploadField.tsx`).
Only the two public banners are reachable by a headless verifier — the gated pair sits
behind the vendor registration token gate — so those two are measured at the rendered pixel
while the gated pair is covered by static assertion.

### F24 — focus affordance

Two distinct defects existed under `.nos-theme` before this feature, both against ruling
R9:

1. **Nine call sites used a 40%-alpha `box-shadow` ring** (`focus-visible:ring-2
   focus-visible:ring-ink/40`), across `VendorFormField.tsx`, `VendorApplyForm.tsx`,
   `VendorRegistrationCodeEntryForm.tsx` (×2), `VendorElectricalEquipmentTable.tsx` (×2),
   `VendorGasEquipmentTable.tsx` (×2) and `VendorRegisterForm.tsx` — `VendorFormField.tsx`'s
   single line alone painted every field of the full vendor registration form. Measured:
   `ring-ink/40` composited to 2.43:1 over `--ivory` and 2.38:1 over `--bone`, both below
   the 3:1 floor; the same `--ink` at full alpha measures 14.84:1. The opacity, not the
   colour, was the entire defect — R9/2 states the same rule R4 states about scrims:
   opacity is not a contrast instrument. `box-shadow`-based rings also fail R9/1 on their
   own terms — clipped by an `overflow: hidden` ancestor, not following an inset radius the
   way `outline` does, and invisible in forced-colors mode.
2. **One ring colour for two grounds** — `nos-theme.css` declared a single
   `--ring-focus: #7e3f97` (violet). Violet measures 6.58:1 on pale gold but only 2.48:1 on
   `--primary-800`, so any NOS control on a purple ground got an almost-invisible ring.

The fix is a single scoped, unlayered `.nos-theme :focus-visible` outline reset —
`outline` + `outline-offset`, never `box-shadow` (R9/1: it follows the border radius, isn't
clipped by an overflow ancestor, and survives forced-colors mode) — reading a ground-paired
`--ring-focus`, itself now backed by two literals exactly like the M8 status tokens:
`--ring-focus-on-light: #7e3f97` (violet, ~6.6:1 on pale gold) and `--ring-focus-on-dark:
#fbfaf0` (pale gold, ~16:1 on royal purple), with `--ring-focus` retained as the consumed
alias so the six sites that already used `outline` + `var(--ring-focus)` correctly
(`Button.tsx`, `SectionNav.tsx`, `NosEventCard.tsx`, `VisitorLinkCard.tsx`, the archive
page, and the M7 masthead lockup link) needed **no call-site edit at all** — only the token
they read changed shape. The reset fixes the nine `ring-ink/40` sites the same way, without
touching one of them. One deliberate side effect: the masthead lockup's own
`outline-offset-4` (the one site that differed from every other's `-offset-2`) is now dead —
the unlayered reset outranks it — and those four now-inert utility classes were stripped
from `layout.tsx` rather than left to lie about intent.

**The `.nos-on-dark` defect a rendered measurement caught.** `.nos-on-dark` (the same marker
class F23 uses for status-token aliasing) was declared correctly in `nos-theme.css` but
**applied to no element in the tree**, so F24's headline dark-ground contrast claim stayed
live at **2.53:1** — against a promised ~18:1 — while every static token-declaration and
computed-style check passed clean. It was caught only because a Playwright pass rendered
the actual page and measured the composited ring pixel against its actual ground, rather
than reading the stylesheet or `getComputedStyle()` in isolation. This is recorded in full,
as the generalised "declared-but-unapplied token" defect shape, in `learned.md`'s
2026-09-08 "NOS M7/M8 verification post-mortem" entry — summarised here, not duplicated:
of eight apparent defects the M7/M8 verifier-hardening pass surfaced that night, seven were
instrument bugs (checks aimed at the wrong referent) and exactly one, this one, was a real
code defect. Both M8 evidence artefacts now carry negative controls that demonstrably fail
(2.17:1 and 2.48:1), proving the harness rejects the broken state rather than passing
regardless of input — the same negative-control discipline §4 above documents for the
hero's contrast fix.

### Verification status

**Codex GPT-5.5 adversarial review: PASS, zero findings**, run against the full M7+M8 diff
via `execution/codex_qa.sh`. 65,022 tokens used, exit 0. Transcript at
`.agent/evidence/nos-design/codex/codex-qa-m7m8-2026-09-08.log`.

Extending §3's "green gate is a measurement, not a standing guarantee" and §8's known gaps:
this repo's triad-verification tooling (`execution/verify_triad_coverage.py`, see
`docs/verification-triad-gate.md`) now runs a **preflight on every gate invocation** that
blocks a UI/workflow contract missing any of the three mandatory verification kinds —
`codex_qa`, `browser_deployed_check`, `gws_inbox_check`. Neither `contract-m7.yaml` nor
`contract-m8.yaml` declares the latter two kinds. `browser_deployed_check` cannot exist for
this branch yet regardless: its manifest requires the page to already be reachable at an
allowlisted deployed origin, and `nos-design` is still an open, unmerged PR — the identical
`TRIAD-02` blocker already recorded against M1–M4 in this mission's own contract
(`.agent/memory/project/specs/nos-design-system/contract.yaml:207`). So M7/M8 carry a real
Codex PASS and a real QA pass, but not a completed three-layer triad; that gap is structural
to being pre-deployment, not a shortcut taken on this milestone specifically.

## Related documents

- `.agent/memory/project/missions/2026-09-06-nos-design-system.md` — the mission record,
  design grammar, and the guardrails referenced throughout this document.
- `.agent/memory/project/specs/nos-design-system/README.md` — the M1 (F1–F3) token,
  font, and logo decision record this document's §1–§2 are drawn from.
- `.agent/memory/project/specs/nos-design-system/platform-README.md` — the M5/M6
  (admin IA, SEO, conversion, social kit) decision record §7 is drawn from.
- `.agent/memory/project/specs/nos-design-system/goldens/nos-contrast.golden.md` — the
  full contrast table.
- `.agent/memory/project/design/nos-design-rulings.md` — rulings R1–R9, the binding source
  for §9–§10.
- `.agent/memory/project/specs/nos-design-system/goldens/m7/` and `.../goldens/m8/` — the
  full M7/M8 golden specifications §9–§10 summarise.
- `app/(marketing)/national-show/nos-theme.css` — the token layer itself; its header
  comment carries the mechanism explanation in full.
