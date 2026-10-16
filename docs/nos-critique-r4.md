# nos-critique-r4 — FAQ category jump chips

Branch `fix/nos-critique-r4`, base `07e09ef3`. Ruling R44-A3 from the SAOC lead (2026-10-16).

## R44-A3 — ruling and decisions

Ruling: "A3 FAQ: YES to the 5 category jump chips. NO filter field: over 14 questions it adds a control that pays
nothing back. Per-answer TBC is R41."

- **No filter.** There is no search or filter control on `/national-show/faq`. Fourteen questions in five groups is
  scannable; a filter would be a control that pays nothing back. Both static and rendered checks assert its absence.
- **Per-answer TBC stays R41.** The `ConfirmationBadge` inside each `<summary>` is untouched. Chips carry no marker.
- **Placement.** First child of the FAQ content column: directly under the hero, above the first category section.
  The hero lede already carries the page intro, so the route file is unchanged.
- **Single source.** `groups` is computed once from `CATEGORY_ORDER` / `CATEGORY_LABELS` in `ShowFaqList`; chips and
  sections both map over it, so a category with no questions yields neither. The nav renders only when more than one
  category has questions.
- **Ids.** Chips link to the existing `faq-<category>` id on each `h2` (also the `aria-labelledby` target).
- **Nav name.** `aria-label="FAQ categories"`: a neutral, non-visible structural label; no visible copy is added.
- **Styling.** The eyebrow-pill grammar (bone ground, primary text, `--radius-pill`) at 14px sentence case, 44px
  minimum height, `flex flex-wrap gap-2`. Never a scroller. No new tokens.
- **Focus ring.** The theme ring (`--ring-focus`, 2px, offset 2px). The hover transition is `transition-[color]`, not
  `transition-colors`: the latter also transitions `outline-color`, so the ring faded in from the text colour and read
  as primary-coloured for the first 150ms (measured: `rgb(33, 26, 87)` instead of the `rgb(126, 63, 151)` ring).
- **Scroll.** Native anchor jump, no JS, no `scroll-behavior`; reduced motion is satisfied by construction. Each `h2`
  carries `scroll-mt-[62px] md:scroll-mt-[74px]` and stacks with `html { scroll-padding-top: 5rem }`.

## Measured (production build, `next start`)

| viewport | chips | rows | min target |
|---|---|---|---|
| 320 | 5 | 3 | 44px |
| 375 | 5 | 2 | 44px |
| 768 | 5 | 1 | 44px |
| 1280 | 5 | 1 | 44px |

The header is `position: relative` (not sticky) at 320 and 375 (144px tall at 375) and `position: sticky`, 96.8px tall,
at 768 and 1280. Headings land at 142px at 375 (62 + 80 stacked) and clear the sticky header at 768 and 1280.
