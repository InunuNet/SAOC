# NOS chrome on the SAOC site: design handoff (Codi → NOS Site), 2026-10-15

Approved by Brad, 2026-10-15. His wording: "Use mono tone in the footer vertical logo, its approved with that one change". The mono change is in.

Reference render: https://claude.ai/artifact/2xfPi1KL6fwiBu3vLFNUHE (Version 6). It is a multi-file artifact; `#tickets`, `#plan-your-visit` and `#symposium` on the hub open those pages.

Source of truth for every value below: `.tmp/sandbox/nos-own-brand-v4/src/chrome.css`, `src/chrome.js` and `build.py`, which generates the header and footer from the SAOC parts. Where this file and the CSS disagree, the CSS wins.

## Scope
- **NOS-branded chrome on `/national-show/*` only.** The NOS header and footer replace the SAOC header and footer on those routes.
- **Every other SAOC page keeps the SAOC chrome**, unchanged.
- **Same site, same structure.**
  - The NOS header carries SAOC's own menu.
  - The NOS footer carries SAOC's own footer content.
  - What changes is the ground, the type, and the logo: the supplied NOS lockup files.
- **No SAOC logo appears anywhere on a NOS page.**
- **Not part of the build:** the "Proposal · NOS branding on the SAOC site" pill (`.np`) and the tickets page's tweak panel (`.tweak-open`).

## Tokens (canvas 262aba20 + rulings)
They are prefixed `--nc-*` so the chrome drops in without colliding with page tokens.

**Colours**

| Token | Value |
|---|---|
| `--nc-royal` | #211A57 |
| `--nc-royal-900` | #1A1445 |
| `--nc-black` | #0B0A14 |
| `--nc-ground` | #FBFAF0 (gold-100, header ground) |
| `--nc-gold` | #F3F2D6 |
| `--nc-gold-300` | #E8E6C2 |
| `--nc-ink` | #3A3654 |
| `--nc-ink-500` | #6A6780 |
| `--nc-line` | #DAD7C8 |
| `--nc-lilac` | #D2CBE8 (footer text) |
| `--nc-green-1` | #A7A841 |
| `--nc-green-2` | #7F7D33 |
| `--nc-olive-700` | #6A6829 |
| `--nc-violet` | #7E3F97 |
| `--nc-white` | #FFFFFF |

**Fonts:** Fraunces for display and menu-panel items; Karla for nav, body and labels (R14). No Cormorant or Jost.
- `--nc-serif: "Fraunces", Georgia, "Times New Roman", serif`
- `--nc-sans: "Karla", "Helvetica Neue", Arial, sans-serif`

**Layout**
- `--nc-gutter: clamp(16px, 2.5vw, 32px)`
- `--nc-wide: 1320px` (content max). The bars are `max-width: calc(var(--nc-wide) + 2 * var(--nc-gutter))`, centred.

**Radii:** 10px on controls, CTAs and links; 16px on the mega-menu rail.

**Shadows**
- `--nc-shadow-float: 0 8px 24px rgba(33,26,87,.08)` (header once scrolled)
- Mega-menu: `0 20px 44px rgba(33,26,87,.12)`

**Focus**
- Header and menu panel: `outline: 2px solid var(--nc-violet); outline-offset: 2px`.
- Footer: `2px solid var(--nc-ground)`, offset 3px.

**Easing:** `--nc-ease: cubic-bezier(0.16, 1, 0.3, 1)`.

**Single theme.** The committee palette has no dark mode, so every colour is set explicitly.

## Header

### Bar
- **Rows, by width:**

  | Width | Layout |
  |---|---|
  | ≥1260px | One row: lockup · nav · Tickets CTA. |
  | 700–1259px | Lockup · Tickets CTA · Menu button; the nav moves into the menu panel. |
  | ≤699px | Two rows (below). |

- **≥700px:**
  - `position: sticky; top: env(safe-area-inset-top, 0px); z-index: 60`.
  - Bar padding `13px var(--nc-gutter)`, gap 24px. **The bar is 97px tall.**
  - Ground `--nc-ground`, with a 1px `--nc-line` bottom border.
  - Once the page scrolls, `.is-scrolled` adds `--nc-shadow-float`. A 1px sentinel with an IntersectionObserver sets it.
- **≤699px:**
  - Row 1 is the lockup at full width. Row 2 holds Tickets on the left and Menu on the right.
  - Padding-block `16px 12px`, gap 12px. **The bar is 146px tall.**
  - **Not sticky** (`position: relative`); the header scrolls with the page. This was approved to keep the logo legible.

### Lockup (header)
- **File:** `nos-full-colour-horizontal-1200.png`, 1200×294. Its ink box is (54,54)–(1139,241).
- **Rendered width** (`--nc-logo-w`):

  | Width | Logo width | Ink width | Location-line cap |
  |---|---|---|---|
  | ≥700px | 448px | 405px | 7.2px |
  | ≤699px | 390px | 353px | 6.27px |
  | ≤420px | `min(390px, calc((100vw - 32px) / 0.904))` | fills the row | — |

- **Negative margins** pull back only the file's transparent padding, so the bar lays out the ink box. Never crop the file instead.
  `margin: calc(W * -0.045) calc(W * -0.0508) calc(W * -0.0442) calc(W * -0.045)`, where W = `--nc-logo-w`.
- `max-width: none; height: auto`. The aspect ratio is always the file's own.
- **Wrapped in `<a class="nh-brand" href="/national-show">`** with `aria-label="National Orchid Show, Western Cape 2027, National Show home"`. It takes `aria-current="page"` on the hub.
- **Always visible,** on every NOS page, at every width, including while the menu panel or the mega-menu is open. Nothing hides it.

### Nav (≥1260px)
SAOC's top level, verbatim from `components/chrome/Header.tsx`, in this order, with National Show inserted after Members:

| Label | href |
|---|---|
| About | /about |
| Societies | /societies |
| Judging & Awards | /judging |
| Events | /events |
| Members | /members |
| **National Show** (button, opens the mega-menu) | — |
| Sponsors | /sponsors |

- **Item style:** Karla 600 at 14.5px. Min-height 44px, padding `0 9px`, radius 10px. Hover and the open state get `--nc-gold` behind them.
- **Current section:** on every NOS page the National Show trigger carries `data-current`. That draws a 2px `--nc-green-1` bar 8px under the label.

### Mega-menu (National Show)
- **Disclosure, click-only (R12):**
  - A `<button aria-expanded aria-controls="nh-mega">` toggles a full-width sheet directly under the header (`position: absolute; top: 100%; left: 0; right: 0`).
  - It never opens on hover. The chevron rotates 180° while open.
- **Closes on:**
  - Escape, which returns focus to the trigger;
  - focus leaving the item;
  - a mousedown outside;
  - a click on any link inside it.
- **Grid:** `1.05fr 1fr 1fr 1fr 0.9fr`, padding `28px var(--nc-gutter)`. Columns 2–4 have a 24px inline padding and a 1px `--nc-line` left border.
- **Content:** verbatim from SAOC's National Show menu (labels and descriptions). No item is invented or renamed.
  1. **Lead column:**
     - The "19th SAOC National Orchid Show" link (Fraunces 1.35rem, green-1 underline) goes to the hub.
     - Meta: "The Hangar, Stellenbosch Flying Club · 23–26 September 2027".
     - Then the **The Show** group: Tickets / Show Sponsors / Past Shows.
     - **No logo in the lead.** It would be a second logo.
  2. **Visit:** About the Show / What to Expect / Plan Your Visit / FAQ.
  3. **Programme:** Programme / Workshops / SAOC Symposium / WOSA Conference / Conference Registration.
  4. **Exhibit & Trade:** South African Exhibitors / International Guests / Exhibitor Entry Guide / Trade Vendors.
  5. **Rail:**
     - `--nc-gold` ground, radius `0 16px 16px 0`.
     - Meta "23–26 September 2027", then an h4 "Tickets" (Fraunces 1.35rem).
     - Two text links: **Day Visitor** → the tickets page's `#ticket-day` card, and **Weekend Pass** → `#ticket-weekend`.
     - The rail has **no Tickets link and no buttons.** Its links have a 44px minimum height.
- **Group heads:** Karla 700 at 12px, 0.14em tracking, uppercase, `--nc-olive-700`.
- **Leaves:** Karla 700 at 14.5px in royal, plus a description at 12.5px in ink-500. Rows have 1px `--nc-line` dividers between them and `padding: 9px 8px`. The current page gets a 2px green-1 underline.

### Tickets CTA
- **One** primary action in the bar, at every width: "Tickets" → `/national-show/tickets`.
- **Style:**
  - Royal ground with ground-colour text.
  - Karla 700 at 13px, 0.12em tracking, uppercase.
  - Min-height 44px, padding `10px 24px`, radius 10px. Hover is `--nc-royal-900`.
- **On the tickets page itself:** `aria-current="page"`. It drops to an outline (transparent, with a 1.5px royal inset ring).
- **It takes the slot where SAOC's Contact button sits.** Contact moves into the menu panel.

### Menu panel (<1260px)
- **Menu button:**
  - Min 44×44px, padding `0 12px`, a 1.5px `rgba(33,26,87,.28)` border, radius 10px.
  - Bars icon plus the label "Menu". When open it shows an × and the label "Close".
  - It carries `aria-expanded` and `aria-controls="nd"`.
- **Panel:**
  - `position: fixed`; the top is set to the header's bottom edge when it opens, so the header and its lockup stay visible above it.
  - Ground `--nc-ground`, scrolls on its own (`overscroll-behavior: contain`).
  - Padding `16px var(--nc-gutter) calc(40px + safe-area-bottom)`.
- **List, in SAOC drawer order:**
  - About, Societies, Judging & Awards, Events, Members;
  - **National Show** (accordion);
  - Sponsors, Contact.
  - Items are Fraunces 400 at 1.375rem, min-height 56px, with 1px `--nc-line` dividers.
- **National Show sub-panel (accordion, `aria-expanded`):**
  - The lead link and meta.
  - The four groups (The Show, Visit, Programme, Exhibit & Trade) with their descriptions.
  - A **Tickets** group: Day Visitor and Weekend Pass as text links.
  - **No second Tickets button.** The header CTA stays on screen above the panel.
- **While open:**
  - Every body child except the header and the panel is `inert`, and body scroll is locked.
  - Focus moves to the first item.
  - On phones the header isn't sticky, so opening scrolls the page to the top and closing restores the scroll position.
- **Closing:**
  - **Escape** closes it and returns focus to the Menu button with `focus({ preventScroll: true })`. Without that, focus jumps the page to the top.
  - Following a link closes it without restoring the scroll position.
  - It closes itself when the viewport crosses 1260px.
- **Motion:** a 260ms fade with an 8px drop, only under `prefers-reduced-motion: no-preference`.

## Footer
- **Content source:** SAOC's footer component, `components/chrome/Footer.tsx` in the SAOC codebase. Keep its columns, links, text and legal row **verbatim**; only the skin and the logo change. Don't fork the copy. Reuse the same data and render it in the NOS skin.
  - Brand text: "A national coordinating body for affiliated orchid societies across South Africa — promoting culture, hybridisation and appreciation of orchids in cultivation since 1968." Then "REG# 1978/004040/08   NPO 043-901".
  - **Explore:** About, Societies, Judging & Awards, National Show, Events, Members Portal.
  - **Partners:** Wild Orchids of Southern Africa, South African National Biodiversity Institute, Kirstenbosch NBG (plain text, as in SAOC).
  - **Stay in touch:** the bulletin text and form, then "Looking for wild orchids?" with "Visit Wild Orchids of Southern Africa →".
  - Base row: "© 2026 South African Orchid Council. All rights reserved." and Privacy, Terms, Refunds, Constitution, Media kit.
- **Not carried over:** no "An event of the South African Orchid Council" endorsement line.
- **Skin:**
  - Royal ground, lilac text.
  - Padding-block `clamp(56px, 7vw, 88px)` top and `calc(76px + safe-area-bottom)` bottom.
  - Heads are Karla 700 at 12px, 0.14em tracking, uppercase, `--nc-green-1`.
  - Links are 15px with 44px rows. Hover goes to ground colour with a green-1 underline.
- **"South African Orchid Council" label:** directly above the brand text, in the `.nf-head` style. It's an organisation name, not new copy. It makes clear the description and REG/NPO line describe SAOC, not NOS. The label, text and REG line sit in one `.nf-org` group, gap 8px.
- **Lockups:**

  | Width | File | Size | Margins | Cap |
  |---|---|---|---|---|
  | >700px | `nos-reversed-horizontal-1200.png` (1200×294, same ink box as the header file) | 448px | same negative margins as the header | 7.2px |
  | ≤700px | `nos-reversed-white-vertical-900.png` (900×791, ink (61,59)–(834,723)), **the mono tone file Brad approved** | `min(342px, 100%)` | none | 7.0px |

  - **Switch with CSS, not `<picture>`.** Use two `<img>` elements with `display: none` on the inactive one. Inside the artifact frame, `<picture>` kept the vertical source at desktop width.
  - **Load both eagerly.**
  - The ≤700 vertical lockup sits centred, with the brand block centred under it.
  - The lockup links to the NOS hub (`/national-show`); see the approved decisions.
- **Grid:**

  | Width | Columns |
  |---|---|
  | ≥1180px | `var(--nc-logo-w)` (448px) plus 3 equal columns |
  | 701–1179px | 3 columns, with the brand block on its own full row |
  | ≤700px | 2 columns; brand centred and full row; Stay in touch full row; base row stacked |

  Gap `48px 40px` (≤700: `40px 20px`).
- **Bulletin form:**
  - **≥701px:** stacked. The email input sits above the Subscribe button, both full column width and 44px tall.
  - **≤700px:** side by side, input `flex: 1`, with an 8px gap.
  - Input: 1px `rgba(210,203,232,.36)` border, radius 10px, placeholder "your@email.co.za".
  - Button: `--nc-gold` with royal text, Karla 700 at 13px, uppercase.
  - Submission is whatever SAOC's Footer.tsx does today; the design adds no behaviour.

## Hub hero
- **h1, exactly:** "19th SAOC National Orchid Show". The text comes from SAOC's menu lead.
  - Fraunces 300, opsz 96.
  - Size `clamp(3.2rem, 2rem + 4vw, 5.5rem)`, line-height 1, letter-spacing -0.01em, `--gold-100`, max-width 11ch (three lines).
  - At ≤700px: `clamp(2.8rem, 12vw, 3.4rem)`.
- **No lockup in the hero.** The header carries the one NOS logo. Don't add an edition line ("The Flagship · Edition XIX"); it would repeat the h1.
- **Kept from the approved hub:** the lede, the facts (Dates / Host / Venue / Cycle), and the CTAs Plan your visit and Find your society.
- **Size:** `min-height: clamp(600px, calc(100svh - 97px), 820px)` on `--black`.
- **Photo:** `orchid-dark-1400.jpg`, inset 22% from the left, with a left mask feathering it into the black.
- **Scrim:** one near-black horizontal ramp, never purple (R15):
  `linear-gradient(90deg, rgba(11,10,20,.94) 0%, rgba(11,10,20,.92) 30%, rgba(11,10,20,.8) 44%, rgba(11,10,20,.4) 58%, rgba(11,10,20,.14) 78%, rgba(11,10,20,.04) 100%)`
- **≤700px (R4):** no scrim. The copy sits on solid black and the photo stacks below it as a 4:3 block. The bloom is never behind the type.

## Lockup files
- **Masters** (read only) are in `SAOC/branding/National Show 2027/Logo/`.
- **Rules:** downscale with Lanczos only. Never typeset, recolour, crop, trim or redraw.

| Use | Master (px, alpha ink box) | Ship as |
|---|---|---|
| Header, all widths | `NOS-2027-logo-full-colour-horizontal.png` (4108×1008, ink 192,192–3891,816) | `nos-full-colour-horizontal-1200.png`, 1200×294 |
| Footer >700px | `NOS-2027-logo-full-colour-reversed-horizontal.png` (4108×1008, same ink box) | `nos-reversed-horizontal-1200.png`, 1200×294 |
| Footer ≤700px | `NOS-2027-logo-reversed-white-vertical.png` (3272×2876, ink 229,224–3023,2620) | `nos-reversed-white-vertical-900.png`, 900×791 |

- **Cap formulas:**
  - horizontal: location-line cap = 66/4108 × rendered width;
  - vertical: location-line cap = 67/3272 × rendered width.
- **Alt text:** "National Orchid Show, Western Cape 2027".
- **Sandbox copies** (byte-identical to what's live in the reference) are in `.tmp/sandbox/nos-own-brand-v4/publish/img/`.

## Approved decisions (Brad, 2026-10-15)
1. **Tickets CTA:** it takes the slot of SAOC's Contact button. Contact stays in the menu panel.
2. **Left off NOS pages:** Search and SAOC's utility bar.
3. **Mega-menu lead:** no logo; just the "19th SAOC National Orchid Show" link and the meta line.
4. **Rail:** Day Visitor and Weekend Pass as text links to the matching ticket cards. No rail Tickets link and no button.
5. **Menu panel:** no second Tickets button.
6. **Phone header:** two rows and not sticky, so the logo stays at 390px with a 6.27px cap.
7. **Hub h1:** "19th SAOC National Orchid Show". The edition line is dropped.
8. **Logo links:** the header and footer lockups both link to the NOS hub (`/national-show`), not to SAOC home. SAOC is reached through the nav and the footer links.
9. **Footer vertical lockup:** the mono tone reversed-white file.
10. **"South African Orchid Council" label** above the footer description.
11. **Footer bulletin form:** stacked at desktop.
12. **Logo count:** header logo plus footer logo is allowed while the footer is on screen. Otherwise one logo per viewport.
13. **Links to NOS pages not yet built:** they go to their existing `saoc.co.za/national-show/...` routes.

**Still open with the committee: the show dates.**
- This design uses **23–26 September 2027** (the rulings), in the hero facts, the mega-menu meta and the rail.
- The live hub says **16–19**.
- Read the dates from one source (Sanity or the show config) so a single change fixes every place. Don't hard-code them.

## Acceptance checks (measure in a real browser at 1280×800 and 390×844)
- **Logos:**
  - One NOS logo per viewport.
  - Header plus footer is allowed only while the footer is on screen.
  - The header logo is visible at the first screen of every NOS page.
  - No other logo image appears in the chrome or the hero.
- **No SAOC mark** anywhere on a `/national-show/*` page: header, footer, mega-menu or menu panel.
- **Lockup sizes:**
  - Header 448px (cap ≥7px) at desktop and 390px (cap ≥6px) at 390.
  - Footer 448px horizontal at desktop and 342px vertical mono at 390.
  - Aspect ratio intact, and the ink never clipped.
- **Type floor:** no text below 12px, apart from the visually hidden labels.
- **Targets:** every link, button and input is ≥44×44px. The only exceptions are inline text links inside running copy.
- **Contrast:** hero text measured at the brightest composited pixel behind it is ≥4.5:1. The reference measured 4.71 minimum at 1280 (the Host label) and 15.48 or higher at 390.
- **No horizontal scroll at 390** on any page. `document.documentElement.scrollWidth` must equal `innerWidth`.
- **Fonts:** only Fraunces and Karla are loaded.
- **Console:** no errors.
- **Keyboard:**
  - The mega-menu opens by click or Enter, never by hover. Escape closes it and focus returns to the trigger.
  - The menu panel makes the rest of the page inert. Escape closes it, focus returns to Menu, and the scroll position is kept.
  - `aria-expanded` stays in sync on the trigger, the Menu button and the accordion.
  - `aria-current` is correct on the current page's leaf and on the Tickets CTA on the tickets page.
- **Tickets page:** the Day Visitor and Weekend Pass links land on their cards. On phones the jump ignores the header height, because the header isn't sticky there.
- **SAOC pages (regression):** every non-NOS route still renders the SAOC header and footer, unchanged.
