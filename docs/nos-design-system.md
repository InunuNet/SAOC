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

## Related documents

- `.agent/memory/project/missions/2026-09-06-nos-design-system.md` — the mission record,
  design grammar, and the guardrails referenced throughout this document.
- `.agent/memory/project/specs/nos-design-system/README.md` — the M1 (F1–F3) token,
  font, and logo decision record this document's §1–§2 are drawn from.
- `.agent/memory/project/specs/nos-design-system/platform-README.md` — the M5/M6
  (admin IA, SEO, conversion, social kit) decision record §7 is drawn from.
- `.agent/memory/project/specs/nos-design-system/goldens/nos-contrast.golden.md` — the
  full contrast table.
- `app/(marketing)/national-show/nos-theme.css` — the token layer itself; its header
  comment carries the mechanism explanation in full.
