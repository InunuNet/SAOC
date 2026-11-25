# NOS anchor landings

Every NOS hash target (faq, plan-your-visit, sponsors) lands 24px below the lowest pinned element
(NOS Design ruling, A13 sweep). Pinned chrome is the NOS header from 768 and, from 768 to 1023, the
48px doc-index bar under it. Below 768 the header scrolls away and only the index bar (on doc pages)
pins.

## Tokens (each defined once)

| token | value | defined in |
|---|---|---|
| `--nos-header-h` | `97px` | `:root` of `components/nos-chrome/nos-chrome.css` |
| `--nos-landing-air` | `24px` | same `:root` |
| `--doc-index-bar-h` | `48px` | `html` block of `app/globals.css`; the index bar height is `var(--doc-index-bar-h, 48px)` so SAOC is unchanged |

The header height is set by the brand image, not by CSS, so `--nos-header-h` is a measured constant:
the header renders 96.9px at every width from 768 to 2056. `checks/probe-chrome.mjs` fails if it
drifts more than 1px from the token.

## Per-band landing (doc headings and generic `[id]` targets)

| band | pinned chrome | landing = chrome bottom + `--nos-landing-air` |
|---|---|---|
| under 768 | doc-index bar only (top 0) | 72 on doc headings, 24 on other targets |
| 768 to 1023 | header + index bar (bar sticky top = `--nos-header-h`) | 169 on doc headings, 121 on other targets |
| 1024 and up | header (index is a side card) | 121 |

## The 768 switch

The header is `position: sticky` from 768 (`nos-chrome.css`), not 780. The doc variables in
`nos-structure.css` (`--doc-index-top`, `--doc-scroll-margin`) therefore switch at `min-width: 768px`.
The old comment "not sticky under 780" was wrong and is corrected. Under 1024 a NOS-scoped rule
sets the index-band heading margin to `--doc-scroll-margin` minus the root scroll padding (0 on the
NOS host); the shared `+ 64px` rule in `globals.css` stays for SAOC.

The sponsor enquiry card (`[data-sponsor-enquiry='nos']`) uses the same tokens: `--nos-landing-air`
below 768, `calc(var(--nos-header-h) + var(--nos-landing-air))` from 768.

## Running the gate

`python3 execution/contract.py gate .agent/memory/project/specs/nos-anchor-landings/contract.yaml`
runs the static checks, tsc, eslint, a clean replay build (`checks/build.sh`) and the rendered gate
(`checks/gate-rendered.sh`), which measures landings at 390, 767, 768, 779, 780, 1024, 1440 and 2056.
