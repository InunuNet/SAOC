# NOS critique round 2 — item 1, R35 and R36

Source: `.tmp/sandbox/nos-excellence-critique/round-2/REPORT.md` (round 2, item 1) and the NOS Design ruling R35. Class and CSS changes only. No copy changed (`docs/rules/no-invention.md`).

## Item 1 — prose measure capped at 60ch

Six routes under `app/(marketing)/national-show/` ran prose wider than the 60ch bar (bios 68ch, ledes 58ch, everything else 60ch). Ledes were already at or under 58ch and are untouched.

| route | change |
|---|---|
| about | `[&>p]:max-w-[60ch]` on the intro container |
| what-to-expect | `[&>p]:max-w-[60ch]` on the intro container; `[&_p]:max-w-[60ch]` on the 1280 container (VisitorInfoBlock and card paragraphs; `p` only, so cards keep their grid tracks) |
| sa-exhibitors, international-guests | `ShowContentState` wrapped in the critique-r1 `contents` scope (`.nos-show-page-prose` p/li); the `RealEmptyListing` branch only gets `[&_p]:max-w-[60ch]`; the entity grid is not wrapped |
| programme | the same `contents` scope around `ShowContentState` |
| faq | `[&_details_p]:max-w-[60ch]` on the container (answers, not accordion rows); `max-w-[60ch]` on the contact note |

No cap on `[data-nos-content-state]`, and no `li`/`ul`/`ol` selector outside `.nos-show-page-prose`.

Item 3 (about 2+1 orphan) does not reproduce: about has no card grid. It is a regression guard only. Item 6 (FAQ TBC chip on answered questions) is Sanity `showFaq.status` data and was not contracted.

## R35 — presenter type (`presenters.css`)

Codi's R35, verbatim: "1. `.pc-role` tracking follows case. Uppercase: label role, Karla 700 12px .14em. Sentence or title case: 0 tracking. The current .08em is wrong either way. Pick the role that matches the rendered case. 2. `.pc-title` and `.pc-name` must meet the card-title role: Fraunces 400, 22/1.25, opsz 24."

- `.pc-role` renders uppercase, so it takes the label role: 0.75rem, 700, 0.14em.
- `.pc-name`: 1.375rem, line-height 1.25, weight 400 (Fraunces and opsz 24 already set).
- `.pc-title`: R36 (NOS Design via the lead, 2026-10-16) corrects R35. "Presenters" is a section heading, so it takes the nos-theme section-h2 role (`.nos-theme h2`: `clamp(2rem, 1.5rem + 1.6vw, 2.4375rem)`, line-height 1.15, -0.01em, opsz 48). The rendered check compares it with a probe h2 inside `.nos-theme`; the route's own label h2s render at 16px, so they cannot serve as the reference.
- The `max-width: 560px` `.pc-name` size override is removed; 22px holds at every width.

Out of scope: `.pc-sheet-title`, the dialog, `.pc-name` letter-spacing.
