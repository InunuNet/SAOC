# Foreword layout v2 (compact, collapsed by default)

Trigger (Brad, verbatim): "This layout doesn't work for the forward. We're wasting so much space and we're forcing the user to scroll for ages. Can we work on a better layout for just the forward?"

## Assumptions (Brad has given full autonomy; recorded, not asked)
- A1. Intro = paragraph 1 only (about 95 words, already long). `HOME_FOREWORD_INTRO_COUNT = 1` in lib/data/home-foreword.ts.
- A2. Spelling "Forward" and all copy stay verbatim; Brad has not ruled on "Foreword" (see spec.md).
- A3. Button label is "Continue reading" (collapsed) / "Show less" (expanded); it avoids the Forward/Foreword word until Brad rules. aria-controls may be built with Array.from (`.filter(` is banned in this codebase).
- A4. Sticky offset 121px = 97px header (globals.css:160) + 24px gap.

## Files
- components/home/ForewordSection.tsx: stays a SERVER component (no 'use client'). Renders `<section>` + `saoc-container`, passes label, heading, HOME_FOREWORD_PARAGRAPHS and HOME_FOREWORD_INTRO_COUNT as props to the client component. Keeps the HOME_FOREWORD_HEADING doc comment line (contract A4 greps the heading string).
- components/home/ForewordExpandable.tsx (new): `'use client'`, owns `useState(false)`. Renders the grid, left column, button, and ALL paragraphs. Exported only to ForewordSection (not the barrel).
- lib/data/home-foreword.ts: add `export const HOME_FOREWORD_INTRO_COUNT = 1;` Copy untouched.

## Section element
`<section className="py-12 lg:py-16 bg-ivory border-t border-rule" aria-labelledby="home-foreword-heading">`
- Padding 48px mobile, 64px from lg. Neighbours: MissionBlock/EventsStrip/YearbookStrip `py-24` (96px), PartnersSection `py-20` (80px, the smallest). Foreword must be <= `py-20`; it is deliberately smaller because it is a reading band, not a hero. Never `py-24`.
- The only gap above is MissionBlock's own `py-24` bottom; do not edit MissionBlock.

## Grid
`<div className="grid lg:grid-cols-[5fr_7fr] gap-x-16 gap-y-6">` inside `saoc-container`.
- Below 1024px: one column, order heading block then body. Nothing sticky. 390px is covered by this.
- From 1024px (lg): two columns.

## Left column (heading block)
`<div className="lg:sticky lg:top-[121px] lg:self-start">`
- eyebrow: `<div className="mb-5"><span className="eyebrow">Forward</span></div>` (unchanged)
- h2 id `home-foreword-heading`: classes unchanged from the current file (serif clamp heading).
- Button, `mt-6`, ONE persistent element, `type="button"`:
  `inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary-800 transition-colors duration-150 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]`
  (the text-link button already on the home page: EventsStrip.tsx:52. No filled button invented.)
  - `aria-expanded={open}` (SSR renders `aria-expanded="false"`)
  - `aria-controls` = space-separated ids of the collapsed paragraphs (`home-foreword-p-2` ... `home-foreword-p-6`)
  - Label: collapsed "Continue reading"; expanded "Show less".
- Sticky exists so the heading and button stay beside the text once expanded.

## Right column
`<div className="doc-prose">` (max-width 64ch, about 65ch measure; globals.css:733).
- `paragraphs.map((paragraph, index) => <p key=... id={`home-foreword-p-${index + 1}`} hidden={!open && index >= introCount}>{paragraph}</p>)`
- Collapsed (default, and the SSR HTML): paragraph 1 visible; paragraphs 2 to 6 (including the sign-off "Douglas McMurtry.") carry the `hidden` attribute but are present in the HTML.
- Expanded: no paragraph hidden. `hidden` is the attribute, never conditional rendering, never `.slice`.
- Do not put a `display` utility class on the `<p>` elements (it would override `hidden`).

## Behaviour
- Toggle flips state only. No height animation, no `transition-all`, no `animate-*`, no `max-h`, no smooth scroll: nothing to gate on prefers-reduced-motion.
- Focus: the button is the same element in both states, so focus never moves. On collapse, call `headingRef.current?.scrollIntoView({ block: 'nearest' })` (default behaviour, not smooth) so the reader is not stranded far below the section.
- Keyboard: Enter and Space via native button.

## Verification map
A11 button + aria; A12 all paragraphs in markup, hidden split; A13 sticky at lg only; A14 padding vs neighbours; A15 motion, one button, reused button classes, no hex. Run with CHECK_ROOT=<worktree>. A browser screenshot at 390px and 1280px, collapsed and expanded, is the @qa visual check (not an assertion).

## Existing assertions affected
A7 (no 'use client' in ForewordSection) still holds: client code lives in ForewordExpandable.tsx. A9 (doc-prose) is retargeted to ForewordExpandable.tsx in the contract, because the grid and body column move there. A4 keeps passing via the HOME_FOREWORD_HEADING doc comment in ForewordSection.tsx; keep that line. A3/A16 only read lib/data/home-foreword.ts.
