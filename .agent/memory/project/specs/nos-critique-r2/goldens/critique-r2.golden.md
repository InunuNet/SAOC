# nos-critique-r2 F1 — golden

Source: `.tmp/sandbox/nos-excellence-critique/round-2/REPORT.md`, items 1, 3 and 6. Item 4 is R35, a NOS Design ruling relayed by the lead on 2026-10-16 (§5).
Worktree: `.tmp/sandbox/critique-r2`, branch `fix/nos-critique-r2`, base `ff1a7e18`.
NO INVENTION: this change only adds classes. No copy string is added, removed or changed.

## §1 Footprint
Only these paths may differ from `ff1a7e18`:
- `app/(marketing)/national-show/{about,what-to-expect,sa-exhibitors,international-guests,programme,faq}/page.tsx`
- `contracts/checks/nos-critique-r2/` (architect-owned; pinned by `checks.sha256`)
- `docs/nos-critique-r2.md`
- `app/(marketing)/national-show/presenters.css` (R35 only, §5)
- `contracts/checks/nos-presenter-cards/check-styles.mjs` (architect-owned; R35 pins only)

Off limits:
- ShowContentState
- `components/nos-chrome/*`
- `national-show/layout.tsx`
- `components/nos/*`
- `components/tickets/*`
- every shared component: ShowFaqList, VisitorInfoBlock, RealEmptyListing, ConfirmationBadge, ShowSectionNav and the rest.

## §2 Measure: rev 3 bar (bios 68ch, ledes 58ch, everything else 60ch)
Each route gets the exact class edits below.

| route | edit |
|---|---|
| about | intro container `mx-auto max-w-[900px] space-y-6 px-8 py-16` adds `[&>p]:max-w-[60ch]` |
| what-to-expect | intro container (`... pt-16`) adds `[&>p]:max-w-[60ch]`. The `max-w-[1280px]` container adds `[&_p]:max-w-[60ch]`, which caps VisitorInfoBlock and card `<p>`. It targets `p` only, never li, dt or dd, so the cards keep their grid tracks |
| sa-exhibitors, international-guests | `<ShowContentState>` becomes the first child of `<div className="contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]">`, the critique-r1 wrapper. The `<RealEmptyListing .../>` branch only is wrapped in `<div className="[&_p]:max-w-[60ch]">`. The ShowEntityGrid branch is not wrapped |
| programme | the same `contents` wrapper around `<ShowContentState>` |
| faq | container `mx-auto max-w-[900px] px-8 py-16` adds `[&_details_p]:max-w-[60ch]`, which caps the answers but not the accordion rows. The faqContactNote `<p>` adds `max-w-[60ch]` |

Forbidden:
- any cap on `[data-nos-content-state]`;
- any `li`, `ul` or `ol` selector outside `.nos-show-page-prose` (the critique-r1 Codex P2);
- any `max-w-[>60ch]`.

Ledes are untouched and already ≤58ch.

## §3 Rendered (A7)
Measured at 375/768/1280, plus 360 for overflow only, on `next start`, port 3010–3019 and never 3002.
- Every visible `<p>` in `<main>` that is at least 40 characters and outside header, nav and footer is ≤60ch.
- An `<li>` counts only when it has no block children.
- The hero lede is ≤58ch.
- No horizontal overflow.
- SCOPE probe: a grid li fills its track, and a prose li is ≤60ch.
- About: no `display:grid` in main outside nav ends on a partial last row.

## §4 Decisions on items 3 and 6
- **Item 6: FAQ chip.** Stopped and not contracted. The chip comes from Sanity `showFaq.status`, through `showFaqsQuery`, the shared `ShowFaqList` and ConfirmationBadge. Base renders 13 pending chips and 1 confirmed ("When is the show?"). The venue FAQ's chip is a data issue: the venue answer ("At the hangar at Stellenbosch Flying Club…") has no source in `content/drive-source`. Its status must move to `confirmed` in Sanity once the committee confirms the venue wording. A page-level override would be hand-picking (NO INVENTION).
- **Item 3: about 2+1 orphan.** Not reproducible on `ff1a7e18`. /national-show/about renders prose plus ShowSectionNav, and ShowSectionNav already uses the R13 resolver. There is no card grid. A7 carries a regression guard only. Fail-on-base is impossible.

## §5 R35 — presenter type (symposium, presenters.css)
NOS Design ruling, verbatim: "1. `.pc-role` tracking follows case. Uppercase: label role, Karla 700 12px .14em. Sentence or title case: 0 tracking. The current .08em is wrong either way. Pick the role that matches the rendered case. 2. `.pc-title` and `.pc-name` must meet the card-title role: Fraunces 400, 22/1.25, opsz 24."

`.pc-role` renders with `text-transform: uppercase`, so it takes the label role. Make these declaration changes and nothing else:

| rule | from | to |
|---|---|---|
| `.nos-presenters .pc-title` | `font-size: var(--pc-fs-xl); line-height: 1.15` | `font-size: 1.375rem; line-height: 1.25`. Weight 400, Fraunces and `"opsz" 24` are already in place |
| `.nos-presenters .pc-name` | `font-weight: 300; font-size: clamp(2rem, 1.5rem + 1.1vw, 2.6rem); line-height: 1.04` | `font-weight: 400; font-size: 1.375rem; line-height: 1.25`. Fraunces and `"opsz" 24` stay |
| `.nos-presenters .pc-role` | `font-size: var(--pc-fs-xs); font-weight: 600; letter-spacing: var(--pc-ls-wide)` | `font-size: 0.75rem; font-weight: 700; letter-spacing: 0.14em`. Karla is inherited from `.nos-presenters`; uppercase stays |
| `@media (max-width: 560px)` | `.nos-presenters .pc-name { font-size: 1.85rem; }` | removed (22px holds at every width) |

Out of scope:
- `.pc-sheet-title` and the dialog;
- the `.pc-name` letter-spacing of -0.01em (R35 does not name it);
- the tokens `--pc-fs-xl`, `--pc-fs-xs` and `--pc-ls-wide`, which stay declared.

Computed values at 1280 and 375:
- role: Karla 700 12px, letter-spacing 1.68px, uppercase;
- name and title: Fraunces 400 22px, line-height 27.5px, `"opsz" 24`.

`check-styles.mjs` changes only these pins, each citing R35. The changed pins are title size and line-height, name weight, size and line-height, role size, weight and letter-spacing, and the mobile name size, which must now be undeclared.
