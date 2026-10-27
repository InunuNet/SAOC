# SA-1 desktop nav: measured natural widths (origin/main 48d74378, Chromium, 1440 viewport, localhost)

Source: `.tmp/sandbox/dc/measure-nav.mjs` (data-hd hooks). Container is `.saoc-container`, 32px side padding, so content width = viewport - 64 (1216 at 1280, 1302 at 1366, 1320 at 1384+).

| part | width px |
|---|---|
| logo link (HD-1 box, never shrinks) | 405 |
| About | 60.25 |
| Societies | 83.06 |
| Judging & Awards | 138.94 |
| Events | 65.17 |
| National Show | 117.48 |
| Sponsors | 83.59 |
| Contact | 75.09 |
| nav `<ul>` (7 items, 0.5 gap = 2px) | 635.59 |
| Join a society CTA | 168.36 |
| search icon button | 44 |
| Menu button (labelled) | min 104; icon-only variant 44 |

Gaps ruled: 24 logo->nav, 12 between nav and CTA, 12 between CTA and the trailing icon.

## Fit arithmetic (content width needed)

| row | needed | fits 1216 (1280)? | fits 1302 (1366)? |
|---|---|---|---|
| logo + 7 items + CTA (no search, no menu) | 405+635.59+168.36+36 = 1244.95 | NO (-29) | yes |
| logo + 7 items + CTA + search | 1300.95 | NO | yes by 1px (too tight, fractional) |
| logo + 6 items (Contact in Menu) + CTA, nothing else | 405+558.49+168.36+36 = 1167.85 | yes (+48) | yes |
| logo + 6 items + CTA + 44px icon (search or Menu) | 1223.85 | NO (-7.85) | yes |
| logo + 5 items (Sponsors and Contact in Menu) + CTA + 44px Menu icon | 405+462.9+168.36+44+48 = 1128.26 | yes (+87.7) | yes |

## Decision (architect), for NOS Design to confirm

The ruled sentence says logo + nav + CTA. Dropping only Contact fits the bare row but leaves no visible control to reach Contact or Search, which is a keyboard/touch regression (Search would be "/" and Cmd+K only). The smallest set that keeps a visible 44px Menu control at 1280 is two items demoted (lowest priority first: Contact, then Sponsors; both already trail the nav and Contact is not a NAV entry).

- 1280 to 1383: inline About, Societies, Judging & Awards, Events, National Show + Join CTA + icon-only Menu button (existing `max-[480px]` icon-only pattern, label stays as sr-only/aria-label). Drawer lists all 7 destinations and Search.
- 1384 and up: unchanged (7 inline + search + CTA, 1320 content vs 1301 needed).
- Below 1280: unchanged (Menu-only, labelled).

Alternative if NOS Design prefers 6 inline items: it needs 7.85px more, i.e. it fits from 1296, which breaks the "<=1280" rule. Not recommended.
