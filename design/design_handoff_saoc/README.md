# Handoff: South African Orchid Council — Full Website

## Overview

This package documents the complete **SAOC public website** — a 7-page marketing/informational site for the South African Orchid Council, a federated body of 21 affiliated orchid societies (founded Bloemfontein, 28 July 1968). The site covers the organisation's history, affiliated societies, the national judging programme, the triennial National Orchid Show, an events calendar, and contact.

The aesthetic is **editorial and botanical** — deep sage green, parchment paper, brass accents; a Crimson Pro display serif paired with Manrope sans and JetBrains Mono for labels. Think regional botanical gazette, not tech product.

---

## About the design files

The files in this bundle are **design references created in HTML/React-via-Babel** — prototypes that show the intended look and behavior. **They are not production code to copy verbatim.** The Babel-in-browser setup, the inline-style components, and the `window.*` global exports are prototyping conveniences, not architectural recommendations.

**Your task:** recreate these designs in the target codebase using its established framework and patterns (React + CSS Modules / Tailwind / styled-components / Vue / SvelteKit / Astro — whatever the project uses). If there is no existing front-end yet, **Astro or Next.js (static export)** suits this content-heavy, low-interactivity marketing site well. The `colors_and_type.css` token file is close to production-ready and can be adopted almost as-is.

---

## Fidelity

**High-fidelity (hi-fi).** Colors, typography, spacing, and interactions are final and intentional. Recreate the UI pixel-accurately using the codebase's own component library and styling system. The exact token values are listed below and in `colors_and_type.css`.

---

## Tech notes for reimplementation

- **No build step exists in the prototype** — it uses Babel standalone. In production, compile properly.
- **Routing:** the prototype is a single file with hash-routing (`#home`, `#about`, `#societies`, `#judging`, `#show`, `#events`, `#contact`). In production these should be **real routes / pages** (`/`, `/about`, `/societies`, `/judging`, `/national-show`, `/events`, `/contact`).
- **Data:** all content lives in `src/data.js` as a single `window.SAOC_DATA` object (societies, events, shows, board, awards, show classes, partners). In production this should come from a CMS or structured content files. Treat the values as **sample data** — real society details, member counts, and event dates will be supplied by the council.
- **Fonts:** Crimson Pro, Manrope, JetBrains Mono — all from Google Fonts.
- **Images:** 5 orchid photographs + logo PNGs in `assets/`. The logo is also available in 8 tone/treatment combinations.

---

## Design tokens

All tokens are defined in `colors_and_type.css`. Summary:

### Color

| Token                     | Hex       | Role                                                                              |
| ------------------------- | --------- | --------------------------------------------------------------------------------- |
| `--primary`               | `#384138` | Deep sage — headlines, primary buttons, the one dark "punchline" section per page |
| `--primary-800`           | `#22281f` | Near-ink sage — button hovers, footer & utility-bar background                    |
| `--primary-700`           | `#4a554a` | Mid sage                                                                          |
| `--primary-100`           | `#e8e6dc` | Sage tint (same as bone)                                                          |
| `--accent`                | `#9e8c6b` | Brass — secondary button fill, underline accents, eyebrow text, 2px section rules |
| `--accent-soft`           | `#c2b393` | Pale brass — italic headline color on dark surfaces                               |
| `--parchment` / `--ivory` | `#f4f3ec` | Paper — default page background                                                   |
| `--bone`                  | `#e8e6dc` | Eyebrow pills, alternating section tint                                           |
| `--ink`                   | `#171917` | Body copy                                                                         |
| `--muted`                 | `#636660` | Captions, meta, taglines                                                          |
| `--rule`                  | `#d9d7c9` | Hairline dividers, card borders                                                   |
| `--rule-soft`             | `#e4e1d0` | Fainter hairlines                                                                 |

### Typography

| Family | Stack                              | Use                                                                                                                        |
| ------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Serif  | `"Crimson Pro", Georgia, serif`    | All headlines; weight **500**; one italic emphasis word per headline (color `--primary` on light, `--accent-soft` on dark) |
| Sans   | `"Manrope", system-ui, sans-serif` | Body, buttons, nav; 16px base, 1.55 line-height                                                                            |
| Mono   | `"JetBrains Mono", monospace`      | Eyebrows, meta, stats, table headers; UPPERCASE, 0.18–0.22em tracking                                                      |

**Type scale (clamp, responsive):**

- Hero `h1`: clamp(48px, 7.4vw, 96px), line-height 1.02, letter-spacing −0.02em
- Page-hero `h1`: clamp(42px, 5.6vw, 76px)
- Section `h2`: clamp(34px, 4.4vw, 54px), line-height 1.08
- Section `h3`: clamp(26px, 3vw, 36px)
- Lede: 18–20px
- Body: 16px
- Meta/eyebrow: 10.5–12px mono

### Spacing

8-pt base. Section vertical padding `--section-y: 96px` (72px compact). Page max-width 1280px, gutter 32px.

### Radius / borders / shadow

- Radius: **0** on cards & image wells, **2px** on buttons/inputs, **999px** on eyebrow pills only.
- Borders over shadows: cards use `1px solid var(--rule)` or a tint background.
- Single elevation allowed for floating nav/menus only: `0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)`.

### Motion

150ms ease hovers, 250ms menu opens. Buttons darken one step + lift 1px on hover; shift to `--primary-800` on press (no scale). Hero crossfade is a 1400ms opacity fade between 4 images on a 5.5s interval. No spring physics, no scroll-triggered stagger.

---

## Global chrome (every page)

### Utility bar (top)

- Background `--primary-800`, text `--ivory`, 8px vertical padding, 12.5px.
- Left: `council@saoc.co.za` (mail link, 0.9 opacity) + tagline "Making a difference since 1968" in mono, uppercase, 0.16em tracking, 10.5px, 0.55 opacity (`utility-tagline` — hidden below 900px).
- Right: two pill links — "19th National Show · Sep 2027" (ghost) and "Join a society" (brass fill). Ghost pill hidden below 900px.

### Header

- Sticky, background `--parchment`, gains a soft shadow + `--rule` bottom border once scrolled >4px.
- 18px vertical padding. Three zones: logo (left), nav (center), actions (right).
- **Logo lockup:** ink line-art orchid PNG (`assets/saoc-logo-ink-paper.png`, 48px square) + two-line wordmark — "SA Orchid Council" in Crimson Pro 600 (~23px) and "Making a difference since 1968" in mono, uppercase, 0.22em tracking. Wordmark + tagline `white-space: nowrap`.
- **Nav:** About · Societies · Judging & Awards · National Show · Events · Learn (disabled, "Soon" tag). Active item is `--primary` with a 2px brass underline. 14px Manrope 500.
- **Actions:** search icon button (opens overlay), "Sign in" text link, "Contact" primary button (small).
- **Responsive:** below **1180px** the nav + "Sign in" hide and a hamburger icon button appears, opening the mobile menu.

### Mobile menu

Full-screen overlay (scrim `rgba(34,40,31,0.55)`), right-aligned panel max 360px / 90vw on `--parchment`. Logo + close at top, stacked nav links with `--rule` dividers, footer with email + "Est. 1968".

### Search overlay

- Triggered by header search icon, **⌘K / Ctrl-K**, or **/**. Esc or backdrop click closes.
- Centered panel (max 680px) dropping from 12vh, scrim + 3px blur.
- Search bar with magnifier icon, text input (17px), "Esc" kbd hint.
- Empty state: "Try searching for" + 5 suggestion rows. Typing filters societies + events live (matches name/region/venue/title), shows result count and "→ <page>" targets.

### Footer

- Background `--primary-800`, text `--ivory`, 80px top padding.
- 4-column grid (1.6 / 1 / 1 / 1.2): stacked logo + mission + reg numbers · "Explore" nav · "Partners" list · "Stay in touch" newsletter form + WOSA cross-link.
- Newsletter: email input + brass "Subscribe" button.
- Bottom bar: copyright + Privacy / Constitution / Media kit links. Collapses to 2-col then 1-col at 1100/760px.

### Breadcrumb (interior pages only)

Below header on `--parchment`, 16px padding, `--rule` bottom border, 13px. Format: `Home / <Current page>`.

---

## Screens / views

### 1 · Home (`#home`) — `screenshots/01-home.png`

**Hero** (min-height 720px): 4-image crossfade carousel (violet → pink → purple → dark orchids... lead image is yellow Oncidium), dark sage-tinted gradient scrim. Centered content: eyebrow pill "Since 1968 · Bloemfontein", `h1` "The national home of _orchid culture_ in South Africa." (italic on "orchid culture" in `--accent-soft`), lede, two CTAs ("Find your society" primary + arrow, "19th National Show, 2027" ghost-light), 4 carousel dots (24×2px, active = brass).

**Mission block:** 2-col (0.9/1). Left: eyebrow "Our purpose" + `h2`. Right: 2 prose paragraphs (italic accents, inline WOSA link) + a 4-up stat row (`--serif` 48px numbers in `--primary`, mono labels) divided by a top rule. Stats: 21 societies / 1968 founded / 18 shows hosted / 56 accredited judges.

**Nav blocks:** "Four ways into SAOC" — 4-col grid of image cards (`aspect 4/5` photo with mono badge top-left, then serif title, muted body, meta row with count + brass arrow). Hover: lift 4px + brass border + shadow + arrow shifts right. Links to societies / show / judging / about.

**Next-show band:** full-bleed `--primary` dark. 2-col (1 / 1.1): left image (`bench`), right content — eyebrow-light "Flagship event", `h2` light "The 19th South African National Orchid Show", 4-up meta grid (Dates/Host/Venue/Duration), **live countdown** (days/hours/min/sec, serif 42px brass-soft numbers, mono labels), two CTAs (accent + ghost-light). Countdown target: 2027-09-18T09:00+02:00.

**Upcoming events strip:** "What's on" head + "Full calendar" link. 5 event rows (see Event Row component).

**Yearbook strip:** `--bone` background, 2-col. Left: copy + 3-up meta (Editor/Pages/ISSN) + Subscribe/Past-editions buttons. Right: `aspect 4/5` image with "Est. 1968" tag overlay.

**Partners footer band:** "In collaboration with" + 6-cell grid (serif names on parchment cells, 1px rule gaps), centered.

### 2 · About (`#about`) — `screenshots/02-about.png`

**Page hero** (min-height 480px, `yearbook` image, dark gradient): eyebrow "Our Heritage", `h1` "A federated body of growers, since 1968.", lede.
**Origin story:** 2-col — copy ("Bloemfontein, 28 July 1968.") + figure (greenhouse image, mono caption).
**Pillars** (`--bone`, centered): "Mission / Vision / Our remit" 3-col, each a parchment card with 2px brass left-border.
**Board & Council:** 3-col grid of board cards (round sage avatar with initials, mono role, serif name, society, tenure with top rule). 6 members.
**Timeline** (`--primary` dark): horizontal 6-step rail with connecting hairline + brass dots; serif year + description. 1968 / 1974 / 1990 / 2014 / 2024 / 2027.

### 3 · Societies (`#societies`) — `screenshots/03-societies.png`

**Page hero** (`community` image): "Find a Society" / "Twenty-one societies, nine provinces."
**Filter + grid:** chip row of 10 provinces (each with count badge; active = sage fill) + search box (filters by name/town). Live result count. 3-col grid of **society cards** (mark badge + province tag, serif name, region·founded, definition list of Meets/Venue/Members, "Society page →" link with top rule). Empty state with reset button.
**CTA band** (`--bone`): "Not near a society? Start one." + "Talk to the council" button.

### 4 · Judging & Awards (`#judging`) — `screenshots/04-judging.png`

**Page hero** (`judging` image): "Judging & Awards" / "A system rebuilt in 1990, refined ever since."
**How it works:** 2-col — copy + 3-up stat block (56 judges / 23 student / 3 regions) + tall figure.
**Awards** (`--bone`): "Six awards, one 100-point scale." 3-col grid of award cards (2px brass top-border, mono code like `AM/SAOC`, serif name, threshold, description). 6 awards.
**Become-a-judge CTA split:** 2-col — left image panel (`paph`) with gradient + brass tag, right body with eyebrow + `h2` + numbered 4-step pathway (serif step numbers) + Apply / Download buttons.

### 5 · National Show (`#show`) — `screenshots/05-national-show.png` — THE FLAGSHIP PAGE

**Show hero** (min-height 760px, `bench` image, diagonal sage→ink gradient): eyebrow-light "The Flagship", mono "XIX · Nineteenth Edition", huge `h1` "The South African National Orchid Show", 4-up meta (Dates/Host/Venue/Cycle), **countdown**, two CTAs.
**What it is:** 2-col copy + 4-up stat block (`--bone`): 18 editions / 3-yr cycle / 10 classes / 1,240 entries.
**Three-year cycle** (`--bone`): horizontal stepper — 2024 (past) → 2027 (current, scaled-up sage card with "Next" badge) → 2030 (future, dashed border), dotted rails between. Note below.
**Classes & judging:** "Ten groups" — 5-col grid of class cards (sage icon chip with italic serif abbreviation, mono group, serif name, description). 10 classes.
**Exhibitor information** (`--primary` dark): 4-stage process cards (mono "Stage 01", serif title, mono date range, description) on translucent panels.
**Past shows:** 3-col grid of past-show cards (3/2 image with edition tag, year·host, venue, mono stat chips for entries/visitors/trophies, optional italic note). 5 past editions.
**CTA band** (`--bone`): "Start planning your entry now." + find-society / ask-council buttons.

### 6 · Events (`#events`) — `screenshots/06-events.png`

**Page hero** (`cymbidium` image): "Events" / "The 2025–2026 show calendar."
**Filters:** kind chips (All/Show/Workshop/Council/Launch) + month `<select>` + **List/Timeline** segmented toggle. Live result count.

- **List view:** events grouped by month (serif month heading with 2px brass underline), each an **event row**.
- **Timeline view:** per-month rows (200px serif label + flex-wrap chips, colored left-border by kind).
  Event row component: 110px date block (brass left-border, serif day, mono month/year) · body (mono kind·province, serif title, muted venue) · mono host (right) · arrow. Hover: tint bg + horizontal padding grows + arrow shifts.

### 7 · Contact (`#contact`) — `screenshots/07-contact.png`

**Page hero** (`community` image): "Get in Touch" / "Questions, media, or a plant to show."
**2-col:** Left — "Direct lines" contact list (5 role/name/email rows with top rules) + postal block on `--bone`. Right — **contact form** (parchment card, 1px border, 48px padding): Name, Email, Topic `<select>`, Society `<select>` (optional), Message textarea. Mono uppercase labels. Focus = `--primary` border. **Validation:** name required, email regex, message ≥10 chars; errors show red border + 12px red message. On valid submit → success panel (`--bone`, round sage check, thank-you with first name + email echo, "Send another" reset).

---

## Interactions & behavior summary

- **Hash routing** → convert to real routes. `window.__saoc_nav(id)` scrolls to top on navigate.
- **Hero crossfade:** 4 images, opacity fade 1400ms, auto-advance 5.5s, clickable dots.
- **Countdown:** live `setInterval` to 2027-09-18T09:00+02:00, padded 2-digit.
- **Societies filter:** province chips (single-select) + free-text search, combined, live count + empty state.
- **Events filter:** kind chips + month select + list/timeline view toggle; list groups by month.
- **Search overlay:** ⌘K / Ctrl-K / "/" open; Esc/backdrop close; live filter over societies + events.
- **Contact form:** client-side validation (required name, email regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`, message ≥10 chars), success state.
- **Mobile menu:** <1180px, slide-in panel.
- **Header:** sticky, shadow-on-scroll.

## State (prototype)

- `route` (string) — current page
- `searchOpen` (bool)
- Hero `idx` (carousel position)
- Countdown `remain` ({d,h,m,s})
- Societies `province`, `q`
- Events `kind`, `month`, `view`
- Contact `form`, `errors`, `submitted`
- (Tweaks panel — prototype-only; **omit in production**: serif switcher + density.)

---

## Assets

In `assets/`:

- **Photography (5):** `orchid-yellow.jpg`, `orchid-violet.jpg`, `orchid-pink.jpg`, `orchid-purple.jpg`, `orchid-dark.jpg`. These are the only orchid images; the council will supply higher-res and real show photography for production.
- **Logo (8 treatments):** primary is `saoc-logo-ink-paper.png` (dark line-art on light). For dark surfaces use `saoc-logo-flat-paper.png`. Others: `-flat-sage`, `-flat-brass`, `-ink-brass`, `-sage-brass`, `-sage-paper`, plus `-original` (the legacy mustard badge — **do not use**, kept for reference only).
- **Icons:** thin-stroke line icons drawn inline as SVG (mail, search, menu, close, arrows). In production, substitute **Lucide** at 1.5 stroke weight. Arrows use Unicode `→`. No emoji, no icon font.

## Fonts

Google Fonts: **Crimson Pro** (ital 400/500/600), **Manrope** (400–700), **JetBrains Mono** (400/500).

---

## Files in this bundle

| Path                                | What it is                                                    |
| ----------------------------------- | ------------------------------------------------------------- |
| `colors_and_type.css`               | **Production-ready token + base-type file.** Adopt this.      |
| `SAOC Website.html`                 | The full prototype (open in a browser to interact).           |
| `src/data.js`                       | All content as `window.SAOC_DATA` (sample data).              |
| `src/styles.css`                    | Full prototype stylesheet (reference for exact values).       |
| `src/logo.jsx`                      | Logo lockup component (reference).                            |
| `src/chrome.jsx`                    | Header, utility bar, search, mobile menu, footer, breadcrumb. |
| `src/pages-home.jsx`                | Home sections.                                                |
| `src/pages-interior.jsx`            | About, Societies, Judging.                                    |
| `src/pages-show-events-contact.jsx` | National Show, Events, Contact.                               |
| `src/app.jsx`                       | Routing + state shell.                                        |
| `ui_kits/website/`                  | Cleaner modular component versions + a one-page demo.         |
| `README.md` (design system)         | Brand voice, content fundamentals, visual foundations.        |
| `SKILL.md`                          | Design rules / non-negotiables.                               |
| `screenshots/01–07`                 | Reference render of each page.                                |
| `assets/`                           | Photography + logo files.                                     |

**Start here:** read this README, open `SAOC Website.html` to click through, adopt `colors_and_type.css`, then rebuild page-by-page in your stack using `src/` and `ui_kits/website/` as the source of truth for exact values. Keep the voice (see design-system `README.md`): knowledgeable, quietly proud, no emoji, Latin orchid names italicised.
