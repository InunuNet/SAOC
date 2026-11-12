# Home page Forward section

Sits on the home page between MissionBlock and NavCards. Copy is Lee-Ann's foreword text, verbatim, in `lib/data/home-foreword.ts` (`HOME_FOREWORD_LABEL`, `HOME_FOREWORD_HEADING`, `HOME_FOREWORD_PARAGRAPHS`). Edit text only there. The last paragraph is the sign-off.

## Components

- `components/home/ForewordSection.tsx`: server component. Renders the `<section>` (`py-12 lg:py-16`, deliberately smaller than the neighbouring sections) and passes the copy to the client component.
- `components/home/ForewordExpandable.tsx`: client component. Owns the open/closed state, the heading block, the single toggle button and all paragraphs.

## Collapsed and expanded behaviour

- Collapsed is the default, including in the server-rendered HTML. Only the first `HOME_FOREWORD_INTRO_COUNT` paragraphs are visible (currently 1; change the constant to show more).
- The remaining paragraphs, including the sign-off, are always in the markup and carry the `hidden` attribute while collapsed. They are not sliced or conditionally rendered.
- One persistent button toggles the state: "Continue reading" when collapsed, "Show less" when expanded. It has `aria-expanded` and `aria-controls` listing the collapsed paragraph ids (`home-foreword-p-2` onwards). Focus never moves because it is the same element in both states.
- On collapse the heading is scrolled into view with `scrollIntoView({ block: 'nearest' })`. There is no animation, so nothing needs gating on `prefers-reduced-motion`.

## Layout

- Below 1024px: a single column, heading block then text. Nothing is sticky.
- From `lg`: two columns (`5fr_7fr`). The left column (eyebrow, heading, button) is sticky at `lg:top-[121px]` (97px header plus 24px gap), so the heading and button stay beside the text while it is expanded.
- Body text uses the existing `doc-prose` class (64ch measure). Only existing tokens and classes are used; the button reuses the text-link style from EventsStrip.

## Pending decision: "Forward" or "Foreword"

The label, heading and eyebrow use Lee-Ann's spelling "Forward". Brad has not ruled on whether this should be "Foreword". Until he does, the copy stays as supplied and the button label avoids the word ("Continue reading"). If the spelling changes, edit `HOME_FOREWORD_LABEL` and `HOME_FOREWORD_HEADING` in `lib/data/home-foreword.ts`; contract assertion A4 greps the heading string in `ForewordSection.tsx` and will need updating with it.
