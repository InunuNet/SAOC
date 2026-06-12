# SAOC Design System

Design system for the **South African Orchid Council** — the federated national body (est. 1968) coordinating 21 orchid societies across nine provinces, the triennial National Orchid Show, and the SAOC judging programme.

This is a **generalist system**: editorial, botanical, a little slow. It should feel like a well-made garden journal — not a tech product, not a travel brand, not a startup. The tone is knowledgeable but welcoming; the surfaces are calm; the imagery is real plants.

---

## Brand context

- **Organisation:** South African Orchid Council (SAOC)
- **Founded:** 28 July 1968, Bloemfontein
- **Reach:** 21 affiliated societies, nine provinces
- **Flagship event:** National Orchid Show (triennial — 19th edition, 2027)
- **Programmes:** National judging system (AM/FCC/HCC, 100-point scale), regional training, member registry, yearbook
- **Audience:** members (hobbyist growers, breeders), judges-in-training, show visitors, the press, conservation partners

## Sources & artefacts in this project

| File                         | What it is                                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `SAOC Website.html`          | Full interactive prototype — 8 pages, hero carousel, events calendar, judging page, affiliate list, contact |
| `SAOC Palette Explorer.html` | Side-by-side canvas of 6 candidate palettes × logo treatments (archive)                                     |
| `SAOC Logo Study.html`       | Logo construction + 8 mark variants (archive)                                                               |
| `assets/`                    | Logo PNGs (8 variants) + 5 real orchid photographs                                                          |
| `src/`                       | React component source for the website prototype                                                            |
| `colors_and_type.css`        | Token file — copy into new files to inherit the brand                                                       |
| `ui_kits/website/`           | Reusable website components (Nav, Hero, Button, Card, Footer…)                                              |
| `slides/`                    | 4 deck templates (Title, Section, Data, Image) using the SAOC palette                                       |
| `preview/`                   | Cards rendered in the Design System tab                                                                     |

---

## Content fundamentals

### Voice

- **Knowledgeable but not academic.** We assume the reader cares about orchids. We don't over-explain basics (what an orchid is) but we do explain structure (what a judging panel does, how awards work).
- **Plainspoken, quietly proud.** The council has been around 58 years; copy should feel like it's talking about something it has known for a long time, not selling you on it. No hype words — no "revolutionary", "world-class", "premier".
- **"We" more than "you".** The council is a collective — members, judges, affiliate societies. Copy mostly writes from the inside ("our growers", "twenty-one societies met in Bloemfontein"). Direct second person is reserved for calls to action ("find a society near you").
- **No emoji.** Ever. The brand is a botanical publication, not a consumer app.

### Sentence shape

- Mix long and short. A good SAOC paragraph has one declarative sentence, one with a clause, and one that's just four words long.
- Comfortable with em-dashes and semicolons. Commas over bullet points when the list is short.
- Numbers get written numerally when they're counts (21 societies, 1968, 100-point scale); "one" / "four" when they're rhetorical ("one of the oldest councils on the continent").

### Casing

- **Sentence case** for headlines, section titles, buttons. Not title case. ("Find a society near you" — not "Find A Society Near You".)
- **ALL CAPS** only for the monospace eyebrows and meta labels (`NATIONAL SHOW · SEP 2027`).
- Proper nouns keep their capitalisation: _Phalaenopsis_, _Orchidaceae_, _Johannesburg Orchid Society_.
- Botanical names are italicised (_Disa uniflora_, _Phalaenopsis amabilis_).

### Examples

> **Good:** "Four societies met in Bloemfontein on the 28th of July 1968 to form a national council. Fifty-eight years later, that council coordinates twenty-one societies from the Cape to the Limpopo."

> **Good:** "The 19th National Orchid Show, 2027. Every three years. Four days. A thousand plants at their peak."

> **Not SAOC:** "🌸 Discover the AMAZING world of orchids! Join South Africa's #1 orchid community today! ✨"

### Eyebrow / tag vocabulary

Short uppercase mono strings used as section meta. Examples in use:

- `FLAGSHIP EVENT`
- `EST. 1968`
- `SINCE 1968, REG# 1978/004040/08`
- `NATIONAL SHOW · SEP 2027 · DURBAN`
- `JUDGING · 100-POINT SCALE`
- `TWENTY-ONE SOCIETIES · NINE PROVINCES`

---

## Visual foundations

### Palette — "Sage & Paper"

A botanical, editorial, slightly heritage palette. The website is built on this.

| Token           | Hex       | Role                                                             |
| --------------- | --------- | ---------------------------------------------------------------- |
| `--primary`     | `#384138` | Deep sage — headlines, primary buttons, dark sections            |
| `--primary-800` | `#22281f` | Near-ink sage — hover states, text on very light tints           |
| `--accent`      | `#9e8c6b` | Brass — secondary button fill, underline accents, tag highlights |
| `--accent-soft` | `#c2b393` | Pale brass — muted accents, italic headline colour on dark       |
| `--parchment`   | `#f4f3ec` | Paper — page background                                          |
| `--bone`        | `#e8e6dc` | Eyebrow pills, section tint, rule colour                         |
| `--ink`         | `#171917` | Body copy                                                        |
| `--muted`       | `#636660` | Captions, meta, tagline                                          |
| `--rule`        | `#d9d7c9` | Hairlines, dividers                                              |

Full set in `colors_and_type.css`.

### Typography

- **Serif display — Crimson Pro** — all large headlines. Weight 500, tight line-height (1.02–1.08), slightly negative letter-spacing on very large sizes. Italics used sparingly inside headlines (one word, usually an emotional one) — and when used, the italic is coloured `--primary` for light backgrounds or `--accent-soft` for dark.
- **Sans body — Manrope** — running copy, buttons, nav. 16px base, 1.55 line-height.
- **Mono — JetBrains Mono** — eyebrows, meta labels, tags, stats, table headers. Always UPPERCASE with 0.18–0.22em letter-spacing.

Headlines often mix an italic word into a roman sentence: _"A system rebuilt in 1990, refined **ever** since."_ The italic does the emotional work; the roman does the facts.

### Logo

Two marks, three tones — all live in `assets/`:

- **Ink-paper** (`saoc-logo-ink-paper.png`) — default. Dark botanical line-art on paper. Use on light surfaces.
- **Flat-paper** (`saoc-logo-flat-paper.png`) — paper silhouette for use on the dark sage surface.
- **Flat-sage** (`saoc-logo-flat-sage.png`) — dark sage silhouette for use on light surfaces where the line-art is too fussy.

Wordmark: **"SA Orchid Council"** in Crimson Pro 500, with the tagline **"MAKING A DIFFERENCE SINCE 1968"** in JetBrains Mono, 0.22em tracking, below.

The logo has three layouts — **horizontal** (default, header), **stacked** (centered, footer/hero), **mark** (favicon, dense grids).

### Imagery

- **Five real orchid photographs** in `assets/` — use these; do not generate new flower images.
  - `orchid-yellow.jpg` — Oncidium, bright warm contrast
  - `orchid-violet.jpg` — dramatic Phalaenopsis on dark
  - `orchid-pink.jpg` — pink Phalaenopsis spray
  - `orchid-purple.jpg` — lavender Phalaenopsis in greenhouse light
  - `orchid-dark.jpg` — harlequin Phalaenopsis, evening mood
- **Scrims over photos:** dark sage-tinted gradient (top-left, 60% → 25%), plus a horizontal bone-to-transparent pull on the bottom for headline contrast. Never show a photo edge-to-edge without a scrim behind text.
- **Cropping:** prefer tight, macro crops that show petal structure; full-plant documentary shots go on the affiliate/society pages.

### Spacing & layout

- 8-px base. Sections use `--section-y: 96px` vertical padding (72px compact).
- Page max width: 1280px. Gutter: 32px.
- Columns typically 12-col grid, but the design prefers asymmetric 2-column editorial splits (e.g. 5/7, 4/8) over even thirds.

### Corners, borders, shadows

- **Corners are small or none.** `2px` radius on buttons. `0` on cards and image wells. The only round thing in the system is the eyebrow pill (999px). We are an editorial brand, not a SaaS product.
- **Borders over shadows.** Hairlines use `--rule` (#d9d7c9). Cards rely on `border: 1px solid var(--rule)` or a tint background, not drop-shadow.
- **No glassmorphism, no neumorphism.** A single soft elevation (`0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)`) is allowed for floating nav / menus only.

### Motion

- **Slow and honest.** 150ms ease for hovers. 250ms for menu opens. No spring physics, no stagger-ins on scroll, no confetti.
- **Hover:** buttons darken one step AND lift 1px. Links underline with brass. Nav items shift from muted to ink.
- **Press:** primary buttons shift to `--primary-800`. No scale change.
- **Page transitions:** fade in body at 200ms. No slide-ins.

### Background treatment

- Default page background: `--parchment`.
- Alternating section rhythm: parchment → bone (tint) → parchment → primary (dark sage, "punchline" sections).
- The dark sage section is typically one per page — used for next-show, contact CTA, or major-stat callouts.

---

## Iconography

**No installed icon font.** SAOC uses very few icons; when needed, it uses thin-stroke line icons from **Lucide** (CDN) at 1.25–1.5 weight. Substitute with Lucide if you need a new icon.

- Social icons (Instagram, Facebook, Email) use Lucide at 18–20px, `color: currentColor` inheriting from the surrounding text tone.
- Arrows in links/buttons use Unicode `→` (U+2192), letter-spaced 0.02em. Not an SVG icon.
- Check-marks in feature lists use `✓` (U+2713), coloured `--accent`.
- Section markers sometimes use a small floral glyph — `❀` or the SAOC mark at 24px — used **once per page maximum**.

**Do not** use emoji, material-icons, Font Awesome, or heavily filled icon sets. The look is hand-drawn editorial, not app-ui.

---

## Index — what's in this folder

```
README.md                    ← you are here
SKILL.md                     ← skill invocation for Claude
colors_and_type.css          ← tokens; import into any new file
assets/
  saoc-logo-*.png            ← 8 logo variants
  orchid-*.jpg               ← 5 real photographs
SAOC Website.html            ← full interactive website prototype
SAOC Palette Explorer.html   ← archived palette exploration
SAOC Logo Study.html         ← archived logo variant study
src/                         ← React components powering SAOC Website.html
ui_kits/
  website/
    index.html               ← demo: real website look
    Button.jsx, Nav.jsx, Hero.jsx, Card.jsx, Footer.jsx, Eyebrow.jsx, PageHero.jsx
slides/
  index.html                 ← deck showing all 4 slide templates
  Title.jsx, Section.jsx, Data.jsx, Image.jsx
preview/                     ← cards rendered in the Design System tab
```

To start a new SAOC artefact: copy `colors_and_type.css` and the logo PNG you need, then compose using patterns from `ui_kits/website/` or `slides/`. Keep the voice: knowledgeable, quietly proud, no emoji.
