# nos-critique-r12 F2 — single-ticket heading level (sweep-221, NOS P2)

Source: lead task 2026-10-18; .agent/memory/scratch/sweep-221/grouped.txt (axe heading-order, moderate, /tickets/vip?quantity=1 at 360/375/768/1280:
`article.nk-card > div.nk-ticket > div.nk-main > h3.nk-name` "VIP Ticket" follows the hero h1). BASE main 26fde668. Branch fix/nos-critique-r12, after F1.

## Decision

| item | evidence | ruling |
|---|---|---|
| where the jump is | app/(marketing)/tickets/[slug]/page.tsx:152 NosHero h1 (components/nos/NosHero.tsx:109), then the summary `<TicketCard>` (:169) whose name is a literal h3 (components/tickets/keepsake/TicketCard.tsx:152). On /national-show/tickets, /national-show/conferences and /national-show/workshops the same card sits under a TicketSection h2 (TicketSection.tsx:30), so h3 is right there. | Fix only the single-ticket route. |
| how | The repo already has this idiom: components/show/VisitorInfoBlock.tsx:24 `headingLevel?: 'h2' \| 'h3'`, default 'h3'. | TicketCard gains `headingLevel?: 'h2' \| 'h3'` (default 'h3'), and the name element is that level, keeping `data-ticket-name=""` and `className="nk-name"`. tickets/[slug]/page.tsx adds one line, `headingLevel="h2"`, to its summary TicketCard. No other caller changes. |
| rejected: "summary implies h2" | launch-weekend F18-A28 check-s-cards-render.mts:73 pins the summary name as an h3 at render level. | Rejected: it would turn a green F18 check red and couple level to variant. |
| zero visual change | `.nos-theme .nk-name` (nos-structure.css:985, 0,2,0) sets margin, family, weight, size, line-height, colour, opsz, letter-spacing and text-wrap, so it beats `.nos-theme h2` (nos-theme.css:349, 0,1,1). The heading rules shared by h2 and h3 (:340, base-layer margin :433) apply to both. | Verified by @architect: on the 26fde668 server, swapping the vip h3.nk-name for an h2 in the DOM left all 18 baseline properties and the box identical at 360, 375, 768 and 1280. |

Edits (@dev): components/tickets/keepsake/TicketCard.tsx (prop, default, name element; at most 14 changed lines), app/(marketing)/tickets/[slug]/page.tsx (one added line), and docs/nos-critique-r12.md (an F2 section that names heading-order). No copy changes.

Proof:
- f2-static S1-S4: the prop and its default, the one-line page change, F18-A28 cards render still green (default h3), and the docs.
- f2-rendered: axe heading-order is clean on /tickets/vip?quantity=1 and /national-show/tickets at 360/375/768/1280. The vip name is an h2. Every .nk-name keeps its text, computed style and box from goldens/f2-nkname-baseline.json (captured by @architect from a 26fde668 next start; `--capture` re-records it).
- Negative test by @architect against 26fde668: FAIL on exactly the vip heading-order violation and the h3 tag at all four widths; /national-show/tickets green.
- The vip summary card renders only while sales are open (page.tsx:148). If the build's CMS has sales closed, f2-rendered fails on purpose rather than passing vacuously.
