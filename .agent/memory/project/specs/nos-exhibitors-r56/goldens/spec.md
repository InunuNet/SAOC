# nos-exhibitors-r56 — /national-show/exhibitors (Codi route 56, 2026-10-22)

Source: Codi (NOS Design lead, final design authority), verbatim at `.tmp/sandbox/queue/r56-ruling.md`. Base `origin/main` 015698f7. No invention
(docs/rules/no-invention.md): no new copy, colour, font or token. Every value below is an existing class, token or string.

## Ranked scope
- P1  Public build: `ExhibitorQuestions` is absent (DOM, jump chip, page HTML/flight payload). Preview: the section is a closed native
      `<details>`; the existing H2 "Questions for the show committee" is inside the `<summary>`; visible focus ring, disclosure marker, >=44px target.
- P2  The site status pill (R19 marker, `[data-exhibitor-marker]`) is sentence case with no tracking, like the email and PDF pills.
- P3  Key dates: the per-row pending pills are dropped (the note above the table keeps the one status line). The three standalone links are >=24px tall.

## Findings the spec rests on
- The one `<details>` already on this page in both modes is the "On this page" jump nav (`components/show/ExhibitorJumpNav.tsx`, class
  `mb-10 md:hidden`; `display:none` at 1280). The new one is found only as `details:has(> summary #exhibitor-questions)`.
- "Date to be confirmed" exists nowhere in app/, components/, lib/, sanity/, content/, types/, docs/, design/ or branding/. So the slot is not
  used: the pills are dropped with no replacement, and the check forbids that string. Row "When" cells show `row.dateNote` (the same text the public build shows).
- The pill look comes from the R19 block in `app/(marketing)/national-show/nos-structure.css` (`letter-spacing: 0.14em; text-transform: uppercase`), not
  from StatusMarker.tsx. The rule is scoped to `[data-exhibitor-marker]`; `[data-confirmation-badge]` (visitor pages) is NOT part of r56.
- Base preview @390: page 18,070px, questions section 3,250px. A narrow step-column pill may still wrap legitimately; V5 only fails a pill that wraps although its text fits.

## Dev brief (files, exact changes, source of each value)
1. `app/(marketing)/national-show/exhibitors/page.tsx`
   - After `openQuestions`: `const questionsShown = !publicMode && openQuestions.length > 0;`
   - Chips: replace `openQuestions.length > 0 && info?.questionsHeading` with `questionsShown && info?.questionsHeading`.
   - Wrap `<ExhibitorQuestions ... />` as `{questionsShown ? (<ExhibitorQuestions .../>) : null}` (props unchanged).
   - The three standalone links (Show classes, SAOC judging standards, Wild Orchids): append `inline-flex min-h-6 items-center` to the className (24px, Tailwind spacing 6).
2. `components/show/ExhibitorQuestions.tsx`
   - Keep the early `return null` for no questions. Move the intro `<p>` and the `<ul>` into a `body` fragment.
   - With a heading: `<section id={id}><details><summary className=...><h2 id={headingId} className=(existing h2 classes)>{heading}</h2><svg .../></summary>{body}</details></section>`.
     No `open` attribute. Without a heading: `<section id={id}>{body}</section>` (today's flat markup).
   - summary classes (copy of ExhibitorJumpNav's summary, minus the border): `flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring-focus)] [&::-webkit-details-marker]:hidden`
     (a `font-sans leading-[1.55]` is fine). The svg is ExhibitorJumpNav's chevron verbatim (`aria-hidden`, viewBox 0 0 20 20, `path d="M5 8l5 5 5-5"`, class `shrink-0 motion-safe:transition-transform [details[open]_&]:rotate-180`).
   - The H2 must keep `id={headingId}` and stay an H2. If the NOS theme gives it a margin that pushes the summary over 120px, zero it with `my-0`.
3. `components/show/ExhibitorKeyDates.tsx`
   - Remove the `restatesPending` import (leave `lib/data/exhibitor-keydates-note.ts` in place: contracts/checks/launch-weekend/f18 still imports it).
   - In the "When" cell render `{row.dateNote}` unconditionally, then the badge only when `!hideMarkers && (row.status === 'research' || row.status === 'question')`.
     Pending, confirmed and unrecognised rows get no pill. Delete the R77 #3 comment that no longer describes the code.
4. `app/(marketing)/national-show/nos-structure.css`: directly after the R19 marker block (before `.nos-theme .nos-on-dark [data-confirmation-badge]`), add a SEPARATE rule
   `.nos-theme [data-exhibitor-marker] { letter-spacing: normal; text-transform: none; }` with a one-line comment. Do not edit the R19 block.
5. `docs/nos-exhibitors-r56.md`: records r56. Must mention `r56`, `details`, `publicMode`, `letter-spacing` and `Date to be confirmed` (that it does not exist, so it was not used).
Nothing else may change (footprint). Prettier: only nos-structure.css is dirty at base (10 lines); keep it at 10; the other three files must stay clean.

## Running the checks (worktree .tmp/sandbox/r56, foreground)
`node <spec>/checks/static.mjs`, `footprint.mjs`, `prettier.mjs`; rendered per mode so each build fits one call:
`NOS_EX_MODES=public NODE_OPTIONS='--require "<abs>/.tmp/sandbox/r19-chrome/use-chrome.cjs"' pnpm exec node <spec>/checks/rendered.mjs`, then `NOS_EX_MODES=preview`.
Builds run through `_build.mjs`, which kills a hung build's whole process group after 300s.

## Known limits
- Only the exhibitor pill is changed; the R19 confirmation badge on visitor pages stays uppercase until Codi extends it.
- Key-date rows lose their per-row marker, so an editor who clears `keyDatesNote` leaves the table with no status line.
- Raw-HTML absence (U1) assumes the heading is not rendered anywhere else; the check will show it if it is.
