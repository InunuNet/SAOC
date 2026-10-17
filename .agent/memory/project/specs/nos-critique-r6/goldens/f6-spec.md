# nos-critique-r6 f6 -- R34 /national-show/exhibitors (NOS Design "Codi" sign-off 2026-10-17)

Sources (no-invention, docs/rules/no-invention.md): no new copy. Labels are the page's existing h2 text; "On this page" and the
chevron are the lead-ruled R34 control, not Drive copy. Visual: R52 chips = the FAQ chips in components/show/ShowFaqList.tsx
(approved r5, `goldens/f6-chip-class.txt` is the BASE class string). Lee-Ann Drive mirror: docs/leeann-source/ (exhibitor copy is
Sanity-driven; nothing here edits it). Handoff: design/design_handoff_saoc/ + branding/.

## What changes

1. **Shared chips.** New `components/show/ShowJumpChips.tsx` (server component): props `label` (the nav aria-label) and `items`
   `{href, label}[]`. It renders `<nav aria-label={label} className="mb-10"><ul className="flex flex-wrap gap-2">` and one
   `<li><a href className={R52}>` per item, byte-for-byte what ShowFaqList renders today. The R52 class string
   (`goldens/f6-chip-class.txt`) lives ONLY in this file. `ShowFaqList.tsx` imports it and passes label `"FAQ categories"` and its
   `#faq-<category>` items; its rendered output must not change (rendered check compares class strings, ids and computed style).
   `components/show/index.ts` may export it.
2. **Jump nav.** New `components/show/ExhibitorJumpNav.tsx` (server only, no `'use client'`, no hooks, no handlers), props
   `items`. It owns the copy "On this page" so `exhibitors/page.tsx` gains no copy string (f1's T8 compares copy strings per
   changed file). It renders, from the same items:
   - `>= 768`: `<nav aria-label="On this page">` via ShowJumpChips (`hidden md:block`);
   - `< 768`: `<details className="md:hidden">` with NO `open` attribute, `<summary>` text exactly `On this page`, `min-h-[44px]`,
     an aria-hidden svg chevron that turns when open (`[details[open]_&]:rotate-180`), and the same chip nav inside.
   The summary is 16px: use `text-[length:var(--fs-body,1rem)] leading-[1.55]` (f1 T6 wants exactly `leading-[1.55]` on any
   body-role line; a 14px sans summary would also need an f1 allowlist entry). No CSS file is touched (Tailwind only).
3. **Anchors.** `ExhibitorKeyDates`, `EntryFormLink`, `ExhibitorSteps`, `ExhibitorQuestions` each take an optional `headingId`
   (additive; absent = output unchanged) and put it on their `<h2>` with `scroll-mt-[62px] md:scroll-mt-[74px]` (the r4/FAQ offset).
   `ExhibitorSection` takes the same optional `headingId` for its `<h3>` (same scroll-mt). **Codi Q1 (final): 13 flat chips** = the 4 h2s
   plus the 9 reference-section h3s, in page order, labels verbatim, each target with an id. The page derives the chip items from the SAME
   values it passes as headings (`info?.keyDatesHeading`, `info?.entryFormHeading`, the steps heading constant, `info?.questionsHeading`,
   each reference `section.heading`), only for blocks that render. Step titles and committee-question h3s are not chips. At >=768 the 13
   chips wrap to 2-3 rows (checked <= 3); the 390 `<details>` holds the same 13. Codi Q2 (final): order hero, back link, R11 banner
   with CTA, chips, sections.
4. **Banner CTA (R34 #3).** The R11 banner (`<Badge tone="purple">` "Exhibitor entries are not yet open ... Contact the council to
   be notified.") also renders the existing `Contact the council` button to `/contact` inside the banner. Keep BOTH CTAs: the end
   CTA stays. The label literal appears ONCE in the page source (a `const`, used twice) so f1 T8 (copy multiset) holds. The banner
   text is unchanged. The banner button is `>= 44px` tall.
5. **Order.** hero, back link, banner (with its CTA), chip nav / details, then the sections.
6. **R34 #4 -- IN (cheap).** `ExhibitorSteps` already renders an `<ol>` and an aria-hidden numeral square; the change is the
   numeral: `font-serif` (Fraunces), `>= 16px`, no `font-sans`. Text, order, markup structure unchanged.

## Public-mode rulings (NOS Design, final, P1 for the public flip; lead 2026-10-17)
Gate: the EXISTING `withholdPlaceholderProse()` from `@/lib/data/show-pages` (the faq page already imports it). Call it ONCE in
`exhibitors/page.tsx` and pass the boolean down; no component reads the preview or wall settings itself, nothing is forked.
**Public (withhold = true):**
1. Every row carrying the "Open question for the show committee ... we could not establish this" marker is not rendered at all
   (a key-date row, a step, a reference section: the whole host row). 3 today.
2. The 9 per-section "Researched international show practice ..." markers are gone; that existing string renders ONCE as a single R11
   page-level line directly under the hero (after the banner, before the chip list).
3. The 11 "To be confirmed" chips collapse to ONE R11 status line next to it (the existing pending string). Total markers on the page = 2.
**Preview/beta (withhold = false):** unchanged from BASE: 3 question / 9 research / 11 pending, per row, no page-level lines.
Shared mechanism with f8: new `components/show/ShowStatusLine.tsx` (server only) renders ONE existing marker (`StatusMarker`, via
`ExhibitorStatusBadge` or `ConfirmationBadge`) for a chosen status and labels; a small pure helper picks the status to show from a
list. f8 MAY reuse it for its logistics line; each page passes its own labels (data, no literals). Additive props on the five exhibitor
components (`ExhibitorSection`, `ExhibitorKeyDates`, `EntryFormLink`, `ExhibitorSteps`, `ExhibitorQuestions`) switch the per-row marker and
the question rows off; absent = BASE output.
**Reading to confirm:** "row" = the host element of the question marker. The page-level `ExhibitorQuestions` list (the committee questions
section, an h2) is not a marker row and stays; if NOS Design meant that list too, say so and the check changes.
Rendered check runs the suite in BOTH modes (two `next start` over one build: SHOW_PLACEHOLDER_PREVIEW=true with the beta wall up for
preview, unset for public; the exhibitors route is dynamic so the setting is read per request). Preview asserts goldens/f6-preview-counts.json
(3 / 9 / 11). Public asserts 0 question markers, their host-row text absent, exactly 1 research line (label once), exactly 1 pending line,
2 markers total, both lines between the hero and the chips. Every other f6 assertion runs in both modes.

## Stacked-tree constraints from f1 (do not fight them)
- f1 T8: no copy string added/removed in any CHANGED existing `.tsx`. New copy lives only in new files.
- f1 T5: any `text-[12..15px]` sans line needs `uppercase` or an allowlist entry. The chip line (14px) moves to the new file, so
  **f1's `small-text-allowlist.json` needs `{file: components/show/ShowJumpChips.tsx, contains: "border-primary", kind: control}`**
  (lead to relay to the f1 architect; f6 cannot edit it). ExhibitorSteps' old `font-sans text-[12px] text-muted` entry simply goes unused.
- f1 T6: body-role lines carry exactly `leading-[1.55]`.

## Checks
`f6-static.mjs` (A3), `f6-footprint.mjs` (A2), `f6-rendered.mjs` (A6, 390 and 1280). Rendered needs the build to see Sanity data
(`NEXT_PUBLIC_SANITY_PROJECT_ID`); a build with no data fails loudly ("no content h2").

## Step timing line (Codi, FINAL)
The `{step.when}` paragraph in `components/show/ExhibitorSteps.tsx` (the `<p>` straight after each step `<h3>`, inside `<li>` of the step `<ol>`)
is 14px / 1.45 (computed 20.3px) in ink-700 (`var(--ink-700)`); drop `text-[12px]` and `text-muted`. Tracking and caps are the designer's choice
(eyebrow role only if set in caps). Static S7 and rendered TIMING assert it at 390 and 1280.

## R11 disclosure (page-level pending line) (Codi FINAL)
v4 `.disclosure` anatomy (golden nos-v4/index.html). `components/show/ShowStatusLine.tsx` gets a chip+list variant: props `items?: string[]` and `children`.
DOM: `<div data-status-disclosure role="note">` (bg --gold #F3F2D6, radius 16, shadow-sm, padding 20/24, 16 inline at <=700) containing the existing marker chip
(pill, ONE line, label unchanged), `<p data-status-list>` (16px / 1.55 = 24.8px, ink-700, no uppercase; the rows' own headings joined " · ", first as written,
rest lower case, ending ".") and, for f8, `Be the first to know` (a[href="/contact"]) as the last line inside the surface.
f6: exhibitors/page.tsx passes items= (the headings of the rows that carried TBC chips; each must appear on the page).
Static S8 (f6) / S9 (f8); rendered DISCLOSURE at 390 and 1280 in public mode.

Chip tightening (Codi FINAL): at <=700 the chip INSIDE the disclosure gets letter-spacing 0.06em and 10px inline padding and the surface 16px inline, scoped in
ShowStatusLine (global StatusMarker unchanged). Chip is ONE line at >=360 (390 and 1280 asserted); at 320 up to two lines are allowed (probe in f6/f8-rendered).

## One public surface (Codi FINAL, f6 public mode)
The banner pill, the research pill and the pending disclosure merge into ONE `[data-status-disclosure]` above "On this page", in this order:
chip (the pending label, one line) -> `[data-status-list]` (the rendered headings of the sections that carry TBC content, de-duplicated, first as
written, rest lower case, " · ", ending ".") -> `[data-status-body]` (the existing exhibitors/page.tsx banner sentence, verbatim, 16/1.55 ink-700, not
a pill) -> `[data-status-foot]` (the existing research label, verbatim, 15px/1.55 ink-500, no text-transform) -> the "Contact the council"
primary button, the last item in the surface. ShowStatusLine gains `body` and `foot` props. Preview is unchanged (per-section markers, the
Badge banner). The research label renders once (it is the foot). The list is compared as a SET to the headings of the sections that carry a
pending marker in preview (the ruling's example order "Key dates, steps, entry fees, entry form" differs from page order).

List label (Codi 2026-10-17, FINAL): in the public disclosure list the steps section item is the ruled label "steps" (named const STEPS_LIST_LABEL in exhibitors/page.tsx, commented with the ruling); every other item is its section heading.

Footprint on BASE2 = main 3f45db11: f6 also edits nos-theme.css (the --ink-500 token and the NOS marker rule for the disclosure chip). goldens/batch2-carry-footprint.json lists the one post-merge f9 follow-up in this branch (components/chrome/UtilityBar.tsx, Codex P3 dead isNos branches).
