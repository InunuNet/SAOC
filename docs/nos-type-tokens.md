# NOS type tokens

Source: the NOS Design ruling of 2026-10-28 (NR-1 weight band, NR-6 body and standfirst, NR-7 one h1 and one h2, NR-8 three labels, S-2 numerals). Every value below is that ruling's; nothing here is invented. The spec, contract, goldens and gate are in `.agent/memory/project/specs/nos-type-tokens/`.

This PR is based on #133 (`feat/nos-hub-tablet-serif`) and merges after it. It supersedes #133's LT-1 weight rules, which were a subset of NR-1.

## What changed

- **One weight band for every Fraunces node:** 300 at 32px and up, 400 from 20px to 31.99px, 500 below 20px. The old blanket `font-weight: 400` on headings and on `.font-serif` is gone, so the size decides and a `font-medium` utility under 20px renders 500.
- **A type scale as tokens.** The role clamps, weights and line heights are custom properties (below). Selectors use them; the per-class literal sizes, weights and optical sizes they replace are deleted.
- **One h1 and one h2.** Every h1 is the Display role (`--t-display`, 300, opsz 72), including the hub, inner heroes, the tickets masthead and the 404. Every section h2 is the base `.nos-theme h2` (300, opsz 48). An h2 that is a card or aside title carries `nos-card-title` (Title role); "Explore the show" carries `nos-h3-visual` (H3 role, still an h2 in the outline).
- **Body:** Karla 450, `--t-body`, line height 1.6, ink-700, in `@layer base` so a utility class or a card, hero or ticket rule keeps its own size. The `.nos-theme p { max-width: 60ch }` cap is replaced by `max-width: min(100%, var(--nos-measure))` (38rem) on `p` and `li`; per-page prose sizes and `ch` caps are deleted.
- **Standfirst:** Fraunces 400, `--t-standfirst`, line height 1.45, same measure. Hub lede (400, opsz 28), the italic theme line (400, from the main variable italic) and hero fact `dd` (400, opsz 24, tabular) take their clamps.
- **Names:** `.nos-pr-head h3` is the Name role (300, 32-40px).
- **Three labels:** Label (Karla 600, 14px, no tracking, sentence case, olive on light and light olive on dark), Form label (Karla 500, 14px, ink; `.nos-form-label`, also the header nav links and the contact form labels), and Caps (Karla 700, 14px, 0.12em, uppercase) only for buttons, status pills, the countdown units and the footer column heads. Violet text is gone. The hero eyebrow and the index group heads are now Labels.
- **S-2:** `.nos-num` is `--olive-ink` (#6A6829, 5.53:1 on the parchment), 400, with `max(20px, 0.62em)` so it never drops below the 20px edge of the band.
- **Karla is one variable face** (`weight: '400 700'`) in both `components/nos-chrome/fonts.ts` and `components/nos/NosThemeScope.tsx`, so `font-weight: 450` renders a true in-between instance (it rendered the 500 instance with four discrete faces).
- **Footer family (TYPE-11):** `.nf` re-points Tailwind's `--font-sans` and `--font-serif` at the NOS faces, so the SAOC-owned newsletter form renders Karla without editing `NewsletterSignup.tsx`.
- `FrauncesLedeScope` (a second, 300-only italic file) is deleted; the about and symposium layouts are pass-throughs.

## Where the tokens are

`app/(nos)/national-show/nos-theme.css`, in the second `.nos-theme` block ("NOS type tokens"). Role rules (body, standfirst, title, label, H3) are at the end of the same file. A different ruling on any open question below is a one-line change to a token or one rule.

| Role | Size | Weight | Line height | opsz |
|---|---|---|---|---|
| Display `--t-display` | clamp(40px, 28.1px + 3.05vw, 84px) | 300 | 1 | 72 |
| H2 `--t-h2` | clamp(32px, 29px + 0.762vw, 44px) | 300 | 1.15 | 48 |
| Name `--t-name` | clamp(32px, 30.5px + 0.381vw, 40px) | 300 | 1.1 | 48 |
| H3 `--t-h3` | clamp(22px, 20.9px + 0.286vw, 26px) | 400 | 1.25 | 24 |
| Title `--t-title` | clamp(20px, 19.26px + 0.19vw, 22px) | 400 | 1.25 | 24 |
| Standfirst `--t-standfirst` | clamp(20px, 18.9px + 0.286vw, 24px) | 400 | 1.45 | auto |
| Body `--t-body` | clamp(16px, 15.53px + 0.12vw, 18px) | 450 | 1.6 | n/a |
| Meta `--t-meta` | clamp(14px, 13.63px + 0.095vw, 15px) | 400 | 1.5 | n/a |
| Hub lede `--t-lede-hub` | clamp(20px, 18.5px + 0.38vw, 26px) | 400 | 1.42 | 28 |
| Theme line `--t-theme` | clamp(20px, 17px + 0.62vw, 28px) | 400 italic | 1.3 | auto |
| Fact dd `--t-fact` | clamp(20px, 19.26px + 0.19vw, 24px) | 400 | 1.2 | 24 |

Colours: `--ink-700` prose, `--ink-500` meta, royal headings, `--olive-ink` #6a6829 (S-2 and the Label on light), `--olive` #a7a841 (the Label on dark). `--label-ink` and `--label-ink-on-dark` carry the Label ink.

## The Karla range

`weight: '400 700'` on a single entry of `Karla-latin-normal.woff2`. The variable file's axis floor is 400, so the ruling's "omit weight" is written as the explicit range. The gate proves 450 is real by measuring one string at 400, 450 and 500 (strictly increasing widths).

## Open questions with NOS Design

Defaults used are the architect's. Each is a single token or rule.

1. Label colour: answered (NR-8 text). Olive on light, light olive on dark. The section 1 table (ink-500, lilac) is not used.
2. Hero fact `dd`: the clamp is used (23.17px at 2056); the table says 24.
3. Ticket stub names (`.nk-name`, `.nk-theme`, `.nk-stamp`): weight band only, sizes unchanged.
4. Karla `weight`: `'400 700'`, not omitted.
5. R-W in the 31-32px gap: the strict reading (31.99px is 400).
6. `NosShowIndex` ("Explore the show") is restyled now, though NR-3 may retire it.
7. `h2.nos-index-eyebrow` stays an h2; the markup is not changed to a non-heading.

## The gate

`node .agent/memory/project/specs/nos-type-tokens/checks/gate-type.mjs` (after `checks/build.sh`) walks 24 routes at 390, 768, 1280, 1440 and 2056 on a Sanity fixture-replay production build and asserts the weight band on every rendered Fraunces node, the floors, body, standfirst and measure, the heading roles, the three label tuples, S-2, and the footer family. Raw numbers for this PR are in the PR body.
