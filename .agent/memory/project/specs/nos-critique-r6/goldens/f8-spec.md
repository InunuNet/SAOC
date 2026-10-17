# nos-critique-r6 f8 -- R50 /national-show/what-to-expect (lead ruling 2026-10-16, re-confirmed 2026-10-17)

Sources: copy is move-only. Narrative = `docs/leeann-source/what-to-expect_2026-09-09.md` (Drive "3.1 Info - What to Expect.docx",
seven paragraphs; `goldens/f8-narrative.txt` is that text). Logistics copy is Sanity-driven (`showVisitorInfo`) and untouched.
Structure source: `docs/leeann-source/website-development-specification-v3_2026-09-06.md` 4.3. Handoff: design/design_handoff_saoc/ + branding/.

## What changes (two files: what-to-expect/page.tsx and components/show/VisitorInfoBlock.tsx)

1. **Logistics first (P1) -- by reordering in the page, not by touching LongFormPage.** Render the logistics `NosSection`
   (Show dates, Opening hours, Admission, Food and refreshments, Photography, Cloakroom and plant holding, Accessibility, in that
   order) BEFORE the `NosSection` holding `<LongFormPage>`. `LongFormPage`, `ShowFacts`, `HoldingState`, `show-facts.ts` are
   untouched (structure-locked by the checks), so every other LongFormPage route is unchanged by construction. **No additive
   LongFormPage prop is needed; if you think one is, stop and ask the lead.**
2. **No duplicated fact.** The aside still shows Dates (`23-26 September 2027`) and the new Show dates block shows the same fact.
   Pass `facts={facts.filter(f => f.label !== 'Dates')}` to LongFormPage when the Show dates block renders (dateRange non-null);
   Host, Venue, Cycle stay. Nothing else is repeated (venue/host appear nowhere in the logistics).
3. **Status.**
   - **Preview/beta (Codi Q3, final):** ONE R11 status line per h2 block, and ONLY on a block that is unconfirmed (the marker already renders
     nothing for `confirmed`; never add one to a confirmed block). Inside a block never a chip plus a card plus a heading badge saying the same
     thing: one line, the existing string (`pendingLabel` / `researchLabel`). The dates and hours blocks keep their own single
     `ConfirmationBadge`; `VisitorInfoBlock` keeps its single one; nothing at section level.
   - **Public (Codi, final; supersedes Q3 in public):** behind the one `withholdPlaceholderProse()` call, every UNCONFIRMED logistics row (Opening
     hours, Admission, Food, Photography, Cloakroom, Accessibility; never Show dates) is not rendered, and ONE R11 line sits at the top of the
     logistics block: `<existing pending label>: <hidden row headings, lower case, joined by " · ">`, e.g. "To be confirmed by the show committee:
     opening hours · admission · food and refreshments · ..." (headings are the rows' own h2 text, lower-cased). List exactly the rows that are hidden
     (those that carry a marker in preview), in page order. Directly after it, the existing "Be the first to know" link to `/contact` (the string
     and href are the ones `HoldingState`/plan-your-visit already use; `HoldingState` itself is not touched or wired in). Hidden Admission adds no ticket
     prices. Confirmed rows stay (subject to the unsourced-string withholding below). If no row is unconfirmed there is no line and no link.
   - **New files:** `components/show/ShowHoldingNote.tsx` (server only) renders `ShowStatusLine` (f6's shared one-marker component) with the composed
     label, then the link; it owns the " · " and "Be the first to know" literals so `page.tsx` gains no copy string (f1 T8). The page passes the hidden names.
   - **Hero lede:** `expectIntro` has no Drive source, so it is WITHHELD in public through the same call and kept in preview, where it must not
     equal or contain the first Drive paragraph.
4. **Sibling h2s (P2).** `VisitorInfoBlock` renders `<h3 className="nos-opsz-32 font-serif text-[24px] ...">` today (plan-your-visit
   shares it). Add an additive heading-level prop (`'h2' | 'h3'`, default `'h3'`); the five blocks pass `'h2'`. Opening hours
   `SectionHeading as="h3"` becomes `as="h2"`. All seven h2s compute one font-size and family (use SectionHeading for all, or give
   VisitorInfoBlock the same class; `nos-theme.css` is not edited -- its `[class*='text-[']` rule keeps explicit sizes).
5. **Weekday range (P2).** The FAQ string "Thursday 23 to Sunday 26 September 2027" exists only as Sanity FAQ data
   (`scripts/seed-show-visitor-info.ts:451`, `scripts/fix-show-dates-23-26-sept-2027.ts:97`), not in app source, so it cannot be
   imported. Derive it from `show.showDate` / `show.showEndDate` with `Intl.DateTimeFormat(... { weekday: 'long' ... })`
   (`formatToParts` if the locale orders weekday and day oddly), in the page's existing local `formatDateRange` (replace it;
   `lib/show-identity.ts` is off limits). The rendered line must equal `goldens/f8-weekday-range.txt` exactly; the literal "Thursday"
   or "Sunday" must not appear in app/component source.
6. **Copy.** Move only. No string added or removed (f1 T8 + `f8-static.mjs` S5). The seven narrative paragraphs equal the Drive mirror.

## Source trace and public-mode withholding (Athanor review, relayed by the lead 2026-10-17)
Gate: the EXISTING `withholdPlaceholderProse()` (`@/lib/data/show-pages`, as the faq page uses it), called once in `what-to-expect/page.tsx`.
Public = withhold; preview/beta = everything stays visible exactly as today. Trace of the strings the reviewer flagged (Sanity field
`showVisitorInfo`, seeded by `scripts/seed-show-visitor-info.ts`; Drive mirrors in `docs/leeann-source/`):

| string (field, seed line) | Lee-Ann source? | verdict |
|---|---|---|
| "concession rates for pensioners and children" (`admissionNote`, seed l.265-268) | No. `ticketing-system-details_2026-09-09.md` lists Early-Bird R130, Day Visitor R150, Weekend Pass R400, VIP R300 only; spec v3 4.3 asks "family tickets and pensioner discounts (if applicable)", a question, not a fact | UNSOURCED, withheld in public |
| "a reduced rate for members of affiliated SAOC societies" (`admissionNote`) | No | UNSOURCED, withheld in public |
| "Personal photography is normally welcome ... tripods, flash near the benches ... commercial or press photography usually need prior arrangement" (`photographyPolicy`, seed l.275-277) | No. The only Drive photography text is the consent notice (ticketing doc section 8, vendor form), a different thing; spec v3 4.3 only names "photography policy" as a topic | UNSOURCED, withheld in public |
| "Admission is charged per person per day" / "Whether tickets are sold at the door ... has not yet been confirmed" / "Current prices are shown on the ticket page." | Partly (the day / weekend tickets); the rest honest absence | stays in `admissionNote`, so the whole field is withheld in public; the ticket link stays |

Implementation: an unconfirmed Admission or Photography row is hidden outright in public (rule 3). If the Sanity status says `confirmed` but the text is
one of the unsourced strings above, the body is withheld (Admission keeps its h2 and the "See ticket prices and book" link; Photography disappears).
Preview passes both bodies as today. The check asserts the four phrases in `goldens/f8-unsourced.json` are absent in public and Admission is present in preview.
Items for Lee-Ann's questions doc (nothing filled): (1) which concessions exist, if any (pensioner, child, member, family) and their prices;
(2) the photography policy (personal, tripods, flash, commercial/press); (3) day/hours of opening; (4) food, cloakroom/plant holding, accessibility
wording: the seed sentences ("we expect a holding area will be available") are guesses and are not asserted either way here; (5) the hero lede
"What the show looks like from a visitor's side of the bench ..." (`expectIntro`) is seeded copy with no Drive source (not withheld by this
contract originally; now withheld in public by the lead's ruling).

## Duplicate intro
The Drive paragraph "The 2027 South African National Orchid Show promises an immersive experience ..." is rendered by LongFormPage. The hero lede is
`info?.expectIntro` (Sanity). In the repo's seed it is a DIFFERENT sentence ("What the show looks like ..."), so the duplicate cannot be confirmed
from source: the live Sanity value may have been edited to the Drive text. The check measures the rendered page: that sentence appears exactly once and
the hero lede neither equals nor contains/is contained in the first Drive paragraph. If the live lede equals the Drive paragraph, drop the HERO lede
(keep the Drive paragraph in the template; the byte-for-byte narrative check needs it) -- e.g. pass `lede` only when it differs, no copy changed.
(Whether Codi's v4 golden prefers the reverse is not in the repo; flag it if so.)

## Stacked-tree constraints from f1
- f1 `routed`: `what-to-expect/page.tsx` keeps >= 1 `text-[length:var(--fs-body,1rem)]` (the opening-hours note line).
- f1 T5/T6 apply to any line you move or add.

## Drive-structure gaps (report, do not fill)
- Lee-Ann's "3.1 Info - What to Expect" contains only the title and the seven narrative paragraphs; none is empty, so no section
  needs `HoldingState` and none is wired in.
- Her spec v3 4.3 lists content that has no Drive copy and no Sanity block on the page today: **venue and parking**, **family
  ticket and pensioner discount prices**, **online booking vs tickets-at-the-door**. They stay absent; the Admission block's link to
  /national-show/tickets is the only pointer. Opening hours is Sanity-driven and currently absent when empty.

## Checks
`f8-static.mjs` (A3), `f8-footprint.mjs` (A2), `f8-rendered.mjs` (A6, 390 and 1280).

## R11 disclosure (public holding line) (Codi FINAL)
v4 `.disclosure` anatomy (golden nos-v4/index.html). `components/show/ShowStatusLine.tsx` gets a chip+list variant: props `items?: string[]` and `children`.
DOM: `<div data-status-disclosure role="note">` (bg --gold #F3F2D6, radius 16, shadow-sm, padding 20/24, 16 inline at <=700) containing the existing marker chip
(pill, ONE line, label unchanged), `<p data-status-list>` (16px / 1.55 = 24.8px, ink-700, no uppercase; the rows' own headings joined " · ", first as written,
rest lower case, ending ".") and, for f8, `Be the first to know` (a[href="/contact"]) as the last line inside the surface.
f8: ShowHoldingNote passes items= (the hidden rows headings) and the Link as children; the old "label: names" caps line is gone. The chip text is the pending label alone.
Static S8 (f6) / S9 (f8); rendered DISCLOSURE at 390 and 1280 in public mode.

## 44px targets (Codex P2)
"Be the first to know" inside the surface is >=44px tall (inline-flex, min-height 44), asserted from the DISCLOSURE probe at 390 and 1280. f6 asserts every link inside its surface (the button included).
