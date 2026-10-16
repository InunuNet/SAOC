# National Show long-form template and public holding state

Mission launch-weekend, feature F18a (R75, R76, R77). F18b (catalogue rows) is separate.

## One switch

`withholdPlaceholderProse()` (`lib/data/show-pages.ts`) is the only mode switch. A public build
(`SITE_PUBLIC_LAUNCH=true`) returns true; beta returns false. Every F18 behaviour below that is
"public only" reads that function; beta renders as it did before F18.

## Long-form template (R75)

`components/nos/LongFormPage.tsx` lays out a page as head (h2 and lede), aside (the show facts and
a pull quote), body (the remaining paragraphs with one 21:9 image break) and a Tickets / Plan your
visit pair. Routes: `/about`, `/what-to-expect`, `/vendors` (own `cta={false}`, keeps its CtaBand)
and `/sa-exhibitors` (through `ShowContentState longform`). The break photo per route lives in
`components/nos/long-form-breaks.ts` and only ever renders inside `[data-nos-image-break]`.

Copy is Lee-Ann's, verbatim, from `goldens/f18/longform-copy.json`. The facts (Dates, Host, Venue,
Cycle) come from `lib/data/show-facts.ts`, which the hub hero also uses, so the two never differ.

## Holding state (R76)

`components/show/nos/HoldingState.tsx` replaces a gap block when a public page has no real prose:
facts, sibling cards from `nav-config`, and a "Be the first to know" band. Used by programme,
wosa-conference, international-guests, the archive and the FAQ. It never hides real prose and a
fallback page keeps its `data-nos-content-state` marker on the holding section.

Public mode also drops:
- builder-brief hero ledes (`publicHeroLede`, the nine texts in `lib/data/builder-brief-summaries.ts`;
  kept out of `show-page-presentation.ts` because the F12 static check pins literals there);
- the "Each entry will show" schema preview (`RealEmptyListing.showSchemaPreview`);
- every "To be confirmed by the show committee" chip (FAQ rows, presenter section, vendors,
  sponsors) and the FAQ intro that describes those marks.

## FAQ and exhibitors (R77)

`ShowFaqList hideUnanswered` hides unanswered questions in public; with none left the page holds.
Rows are a full-width summary with a 20px plus/minus icon centred on the row, and the chip sits
inline after the question. These rules are not scoped under `.nos-theme`, because the A5 check
injects the markup into `main`, outside that scope.
`ExhibitorKeyDates` drops a `dateNote` that only restates a pending chip
(`lib/data/exhibitor-keydates-note.ts`).

## Hub

`/national-show` no longer renders `NosShowIndex`; its 16 inner routes keep it. This is the
intended cause of the F17-A4, F17-A19 and F12-A1 hub reds and of the F18-A10 hub allowlist line,
which need spec-branch amendments (reported to the lead, no check edited).

## Verification

Checks live in `contracts/checks/launch-weekend/f18/`. A1 to A3, A5 to A7 need the public build on
port 3672. Critique evidence is `f18-critique-log.md` and the 24 shots in `.tmp/sandbox/lw-f18/after`.
