# Launch weekend F19: SAOC design pass and public-mode provenance

Mission `launch-weekend`, feature F19. Spec: `.agent/memory/project/specs/launch-weekend/goldens/f19/f19-spec.md`.
Contract: `.agent/memory/project/specs/launch-weekend/contract-f19.yaml`. Design rulings are design-cb's and are final.

F19 does two things to the SAOC (council) site and nothing to the National Show (NOS): it applies the design-cb pass
(hero scrim, one left axis, judging split, 16/1.55 type, casing, tap targets, font split), and it makes the public
build stop publishing facts the Council has not supplied.

## 1. Hero scrim and veil

The old single uniform dark layer on the home hero is gone, not hidden. The hero carries three `aria-hidden` layers,
each marked `data-hero-scrim`, in `components/home/Hero.tsx`, styled in the F19 block of `app/globals.css`:

| layer | value |
|---|---|
| `diagonal` | `linear-gradient(135deg, rgb(56 65 56 / .6), rgb(56 65 56 / .25))`: the design README's sage diagonal, 60% to 25% |
| `veil` | a radial gradient in `rgb(34 40 31)` centred on the text zone (about .84 to .9 opaque, fading to 0 at the edge). The ellipse is 100% by 62% below 768px and 56% by 54% from 768px up |
| `bone` | a 72px pull from `var(--bone)` at the section's bottom edge, clear of the content |

The veil keeps the h1, the italic accent, the lede and both CTAs at 4.5:1 or better on all four slides at 390 and 1280
(the `veil` is dark enough that the large-text exemption is not used). Only the text zone is veiled, so the carousel
stays visible in the corners. Browsers serialise `to bottom right` as `to right bottom`, which the check cannot match,
so the diagonal is written as `135deg`.

Hero CTAs sit on the veil: the primary is an ivory fill with primary-colour text, the secondary an ivory outline with
ivory text, both sentence case ("Find your society"). The fill is at least 3:1 against the veil.

## 2. `.saoc-container`: one left axis

`.saoc-container` is `max-width: var(--container-max); margin-inline: auto; padding-inline: var(--container-pad)`, the
header's own tokens. Every SAOC body section keeps its full-bleed background and puts `saoc-container` on the inner
wrapper, so section headings and eyebrows start on the header logo's x at 390, 1280, 1920 and 2056 (A7). The header is
the authority and is not edited.

Excluded by ruling: the legal pages (`/constitution`, `/privacy`, `/terms`, `/refunds`) keep their narrow reading
column, and so stay off the axis (the check prints them as NOTE lines, not failures). The societies and media-kit meta
sizes (labels, mono eyebrows) also stay as they were; only their prose moves to 16px.

## 3. Judging split: 4fr / 7fr

`/judging` prose sections use `JudgingSplit`: heading left, prose right, `[data-judging-split]` is
`grid-template-columns: minmax(0, 4fr) minmax(0, 7fr)` from 1024px and a single column below. The prose column is
capped at 60ch.

## 4. Type: 16px at 1.55

SAOC prose is at least 16px, and 16px prose leads at 1.55 (24.8px). `.p-lg` went from 1.65 to 1.55 in place (the one
non-additive `globals.css` edit); MissionBlock 17 to 16, YearbookStrip 18 to 16, the PageHero lede 17 to 16, and
every sub-16px prose block on judging, contact, sponsors, members and about to 16. 16px blocks that carried
`leading-relaxed` (1.63) now carry 1.55. Labels, meta and mono eyebrows stay small.

### PageHero is shared with two NOS pages

`components/ui/PageHero.tsx` also renders the lede on `/national-show/about` and `/national-show/tickets/buy`, so the
R65 lede change (17px to 16px) reaches those two NOS pages. That is the only NOS effect. The NOS runtime check ignores
paragraphs inside a PageHero root (`data-page-hero`) for exactly this reason.

## 5. Other design rulings

- R64: sentence-case controls across the SAOC routes.
- Home events heading is "What's on", with no duplicate eyebrow; the sponsors h1 is "Sponsors".
- Yearbook: 32px under the copy, copy top-aligned to the photo; the hero h1-to-lede gap sits on the type scale and the
  390 CTAs are equal width.
- A23: events rows link (National Show rows to `/national-show`), carry `<time datetime>`, and emit one Event JSON-LD each.
- A24: the contact form has `autocomplete`, 3:1 field boundaries, a 44px button, `aria-describedby` errors and a
  persistent `role="status"` region.
- A25: every SAOC footer control is at least 44 by 44 at 390.

## 6. Provenance: `withholdPlaceholderProse()` (vote 1C)

Facts that Lee-Ann's Drive does not source (the yearbook, its editor, page count and ISSN; the 21 societies and 56
judges; the 1990 standardisation; the 100-point scale; award thresholds and criteria; "triennial"; the partners claim;
the contact role labels; the placeholder officeholders) are governed by the existing
`withholdPlaceholderProse()` in `lib/data/show-pages.ts`:

- True on the public build: the fact is not rendered at all.
- False only on the beta preview (`SHOW_PLACEHOLDER_PREVIEW=true` with the wall up): the fact is shown, inside a
  `[data-placeholder]` element that carries `PlaceholderMarker`, which prints the existing marker string
  "Not confirmed by SAOC".

`components/ui/provenance.ts` holds the unsourced patterns (`isUnsourced`, `sourcedBlocks`) and mirrors
`provenance.unsourced` in `goldens/f19/tokens.json`; keep the two in step. It is applied to CMS and fallback text alike,
because Sanity currently holds some of these strings too (the home mission text, the contact labels): the CMS is not
edited, the page decides what to render.

Where a whole section is withheld the public page shows `ContentGap`, a `[data-content-gap]` block holding the existing
`ABSENT_SHOW_PAGE_FIXED_SENTENCE` and nothing new. The yearbook band is rendered only on the beta preview.

`PlaceholderMarker` replaces the `StatusMarker` glyph chip here on purpose: the decorative glyph is an extra text leaf,
and F19 adds no copy beyond existing marker strings.

## 7. Font split (A26)

The SAOC faces (Crimson Pro, Manrope, JetBrains Mono) used to load from `app/layout.tsx` for every route, so every NOS
page declared and fetched them as well as its own Fraunces and Karla. The SAOC pages now live in the route group
`app/(marketing)/(saoc)/` (no URL change; `tickets/` is not moved), whose `layout.tsx` holds the loaders. The SAOC header,
utility bar and footer are built above the group, in `app/(marketing)/layout.tsx`, so a wrapper class would not reach
them; the `--font-*-loaded` variables are set on `:root` from the same font objects instead.

Open: `components/chrome/SaocLockup.tsx` still declares Lora, and the shared marketing layout imports it, so NOS routes
still declare Lora. Clearing it needs an edit to that chrome file, which A10 forbids; see the lead message for the
exact diff. Routes outside the group that still show SAOC chrome (`/tickets/*`, `not-found`) fall back to the generic
stacks until `tickets/` is moved in.

## 8. Known limits

- A11 and A11p fold curly quotes to straight on both sides before comparing copy.
- A12 compares NOS pages against a baseline captured from the main working tree; where those pages differ from this
  branch's committed source the check reports drift that F19 did not cause (no F19 edit touches a NOS file).
- Older contracts and `scripts/checks/verify-show-page-m4.ts` hard-code the pre-move `app/(marketing)/<route>` paths.
