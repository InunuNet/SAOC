# Golden: NOS own-brand chrome on /national-show/* (mission nos-own-brand-chrome, F1)

Written by @architect, 2026-10-15. Code target: SAOC worktree `.tmp/sandbox/nos-chrome`,
branch `feat/nos-own-brand-chrome`, base `5ae1f3cf` (origin/main). All paths below are relative to
that worktree unless they start with `.agent/`.

## 0. Sources and precedence (no-invention)

Every element traces to one of:

| Source | What it governs |
|---|---|
| Codi's handoff, approved by Brad 2026-10-15 ("Use mono tone in the footer vertical logo, its approved with that one change"): `.tmp/sandbox/nos-own-brand-handoff/HANDOFF.md`, `chrome.css`, `chrome.js`, `build.py.txt`; reference render artifact 2xfPi1KL6fwiBu3vLFNUHE v6 | every visual value, the markup shape, the behaviour |
| SAOC's own code at 5ae1f3cf: `components/chrome/nav-config.ts`, `Header.tsx`, `Footer.tsx`, `lib/data` partners | every menu and footer label, href, descriptor, line of copy |
| the nationalShow Sanity singleton (via `lib/show-identity.ts`) | show dates and venue |
| the lead's binding conditions (below) and Brad's instructions | scope |

Where HANDOFF and chrome.css disagree, **chrome.css wins**. Where HANDOFF's prose and SAOC's code
disagree on a label, **SAOC's code wins**, because HANDOFF itself says the menu is "verbatim from
SAOC's menu". Not built: the proposal pill (`.np`), the tweak panel, chrome.js's deep-link hash
redirect and its sessionStorage pill code.

## 1. The lead's binding conditions and how each is enforced

| # | Condition | Enforced by |
|---|---|---|
| 1 | `/national-show/*` only; every non-NOS route keeps the SAOC chrome **byte-identical** | A9 `check-saoc-chrome-render` (rendered HTML of `/`, `/about`, `/sponsors`: body-start to `<main`, and `</main>` to `</footer>`, against snapshots taken from 5ae1f3cf on 2026-10-15, copied to `goldens/saoc-chrome-5ae1f3cf/`); A8 `check-saoc-source-untouched` (Header, MobileMenu, MegaMenu, UtilityBar, SaocLockup, SearchOverlay, Breadcrumb, chrome index, the full-name raster, ShowSectionNav, the lockup masters: zero diff). MobileMenu and SearchOverlay render nothing while closed, so their markup is proven by source identity plus the unchanged `NAV` (A4). |
| 2 | Keep the full-name SAOC lockup (d88cd322/c70a1532, `public/images/saoc-lockup-horizontal-full-name.png`, SaocLockup.tsx container-query fit) intact on SAOC routes | A8 (files untouched), A5 (Footer still renders `<SaocLockup orientation="vertical" tone="dark" />`), A9 (rendered markup) |
| 3 | Keep F7's labels: **"Exhibitors and Vendors"**, not HANDOFF's "Trade Vendors" | A4 (derived menu), A10 (rendered mega). HANDOFF's mega-menu says the content is "verbatim from SAOC's menu", so SAOC's current label wins. |
| 4 | All visuals from HANDOFF/CSS only | A2 (`nos-chrome.css` is chrome.css rule for rule), A7 (hero values), A1 (lockups) |

## 2. Route scoping: how the chrome swaps

**Decision:** a client route gate in the marketing layout plus the NOS chrome inside the
national-show layout. No route moves, no middleware header, no CSS hiding.

Rejected: moving `national-show/` into its own route group (renames 19 route directories, breaks
every existing contract path, conflicts with fix/nos-audit-p1); a `proxy.ts` header read with
`headers()` (makes every marketing page dynamic); hiding the SAOC chrome with CSS (the SAOC lockup
would still load on NOS pages); parallel-route slots (soft-navigation keeps a stale slot unless a
catch-all exists, and the catch-all interacts with static generation).

### 2.1 New files

`components/nos-chrome/route-scope.ts` (pure, no directive):

```ts
/** True for /national-show and every /national-show/* path; false for everything else. */
export function isNosRoute(pathname: string | null | undefined): boolean
```
`/national-showcase`, `/national-show-2027`, `/tickets/*` and `/events/national-show` are **false**.

`components/nos-chrome/RouteScope.tsx` (`'use client'`, reads `usePathname()` from `next/navigation`):
- `SaocChromeOnly({ children })`: renders `<>{children}</>` when `!isNosRoute(pathname)`, else `null`.
- `MarketingMain({ children })`: renders `<main>{children}</main>` when `!isNosRoute(pathname)`,
  else `<>{children}</>` (the national-show layout renders its own `<main>`).

Both add no DOM of their own, so the SAOC routes' HTML is unchanged.

### 2.2 `app/(marketing)/layout.tsx`

Keep the `sanityFetch` and the three chrome imports. Render exactly:

```tsx
<>
  <SaocChromeOnly>
    <UtilityBar show={show} />
    <Header show={show} />
  </SaocChromeOnly>
  {/* Breadcrumb injected by individual page layouts in M4+ */}
  <MarketingMain>{children}</MarketingMain>
  <SaocChromeOnly>
    <Footer />
  </SaocChromeOnly>
</>
```
No bare `<main>` remains in this file, and it imports nothing NOS. (contract-sanity-studio-p0's greps
for `UtilityBar`, `Header` and `Footer` in this file keep passing.)

### 2.3 `app/(marketing)/national-show/layout.tsx`

- `export default async function NationalShowLayout`; fetch the singleton exactly as the marketing
  layout does: `sanityFetch<ShowIdentity>({ query: nationalShowQuery, tags: ['nationalShow', 'sanity'] })`.
- Imports, in this order: `'./nos-theme.css'`, then `'@/components/nos-chrome/nos-chrome.css'`
  (same-specificity focus rules: the chrome's must come later).
- Render:
  ```tsx
  <div className={`nos-theme ${cormorantGaramond.variable} ${jost.variable} ${fraunces.variable} ${karla.variable}`}>
    <NosHeader show={show} />
    <main>{children}</main>
    <NosFooter />
  </div>
  ```
- Remove `NosMasthead`, the `<footer data-nos-colophon>` band and the `Logo` import.
- Fonts, identical to the nos-presenter-cards branch so the two merge as the same change:
  `Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-nos-fraunces', display: 'swap' })`
  (no `weight`: the variable font gives the hero's 300); `Karla({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-nos-karla', display: 'swap' })`.
  Cormorant Garamond and Jost stay (NOS page body type; see D2).
- Rewrite the file's comments to describe the new structure (the F21 masthead/colophon comments are obsolete).

DOM on a NOS page: `body > div.nos-theme > [span#nh-sentinel, header#nh.nh, div#nd.nd, main, footer.nf]`.

## 3. Menu: SAOC's own data, derived, never retyped

### 3.1 `components/chrome/nav-config.ts`

`NAV` stays byte-identical. Append one export, nothing else:
```ts
export const CONTACT_LINK = { id: 'contact', label: 'Contact', href: '/contact' } as const;
```
(Header.tsx and MobileMenu.tsx keep their own `/contact` link untouched: lead condition 1. Adopting
CONTACT_LINK there is a later, lead-owned tidy-up.)

### 3.2 `components/nos-chrome/menu.ts` (pure; imports `NAV`, `CONTACT_LINK`, `formatShowDateRange`)

```ts
export const NOS_LOCKUP_ALT = 'National Orchid Show, Western Cape 2027'; // HANDOFF "Alt text"

export function getNosMenu(): {
  top: Array<{ kind: 'link'; id: string; label: string; href: string } | { kind: 'show'; id: string; label: string }>; // NAV order
  lead: { label: string; href: string };            // mega.lead.leadLabel / leadHref
  groups: Array<{ id: string; heading: string; links: Array<{ id: string; label: string; href: string; descriptor?: string }> }>;
                                                     // [mega.lead.theShow, ...mega.columns]
  rail: { heading: string; links: Array<{ id: string; label: string; href: string }> };
                                                     // featureRail.heading; destinations minus variant 'primary'
  contact: { id: string; label: string; href: string };   // CONTACT_LINK
  cta: { label: string; href: string };              // The Show group's own 'tickets' leaf: "Tickets" → /national-show/tickets
};

export function showMenuMeta(show: ShowIdentity | null | undefined): { lead: string | null; rail: string | null };
// lead = [show.venue.name, formatShowDateRange(showDate, showEndDate)].filter(Boolean).join(' · ') || null
// rail = formatShowDateRange(showDate, showEndDate)
```
Throw (fail loudly) if NAV has no `national-show` mega, lead, featureRail or tickets leaf.
`showMenuMeta` is the same composition SAOC's MegaMenu/MobileMenu use inline; it lives here so the
NOS components share one copy. Do not edit MegaMenu/MobileMenu to use it (condition 1).

### 3.3 What renders where

| HANDOFF element | Source |
|---|---|
| Top-level nav (≥1260): About, Societies, Judging & Awards, Events, Members, **National Show** (button), Sponsors | `getNosMenu().top` |
| Mega lead link "19th SAOC National Orchid Show" → /national-show | `.lead` |
| Mega meta "The Hangar, Stellenbosch Flying Club · 23–26 September 2027" | `showMenuMeta(show).lead` (Sanity; omit the span when null) |
| The Show / Visit / Programme / Exhibit & Trade, labels + descriptions | `.groups` ("Exhibitors and Vendors" comes through as-is) |
| Rail meta, h4 "Tickets", Day Visitor, Weekend Pass | `showMenuMeta(show).rail` (omit when null), `.rail` |
| Menu panel: NAV order, National Show accordion, then Sponsors, then Contact | `.top` + `.contact` |
| Panel "Tickets" group (Day Visitor, Weekend Pass as text links) | `.rail` |
| Tickets CTA | `.cta` |
| HANDOFF UI strings: "Menu"/"Close", nav `aria-label`s "Primary"/"Menu", brand `aria-label` `${NOS_LOCKUP_ALT}, National Show home` | HANDOFF, literal |

No eyebrow ("The National Show") in the NOS lead: HANDOFF's lead is the link and the meta only.

### 3.4 Rail destinations (DECISION D1, recommended option applied)

HANDOFF sends Day Visitor/Weekend Pass to `#ticket-day`/`#ticket-weekend` cards on the tickets
page. **Those cards do not exist**: `/national-show/tickets` at 5ae1f3cf is a five-option router
(one "I'm coming to visit" block, four secondary cards) with no Day Visitor or Weekend Pass card,
so there is nothing to put an id on; the cards were in Codi's v13 tickets mock, which is not built.
Adding ids to unrelated elements would send the links to the wrong thing.

Applied: the rail keeps nav-config's own destinations, `/tickets/day-visitor` and
`/tickets/weekend-pass` (both 200 on 5ae1f3cf; the existing per-product purchase pages). This
matches HANDOFF approved decision 13 (links to pages not yet built go to their existing routes)
and keeps one source. No ids are added. If the v13 tickets page is built later, change the two
hrefs in nav-config (one place) and add the ids then.

## 4. Show dates: one source

The dates are still open (23–26 vs 16–19 September 2027). The single source is the nationalShow
Sanity singleton (`showDate`, `showEndDate`, `venue.name`), formatted by
`lib/show-identity.ts#formatShowDateRange`; it already feeds the hub hero's "Dates" fact, the SAOC
mega meta and the UtilityBar pill. On 2026-10-15 it renders "23–26 September 2027". No file under
`components/nos-chrome/` and not the national-show layout may contain a month name, a year (except
inside `NOS_LOCKUP_ALT`) or a date range (A6). A10 asserts the rail meta equals the hero's Dates
fact on the hub.

## 5. Footer: Footer.tsx's data, NOS skin

### 5.1 `components/chrome/Footer.tsx`: export the data, render byte-identical

Export these constants with exactly the 5ae1f3cf copy (A5 evaluates them):

| Export | Value |
|---|---|
| `FOOTER_NAV` | the existing array, now exported, unchanged |
| `FOOTER_HEADINGS` | `{ explore: 'Explore', partners: 'Partners', touch: 'Stay in touch' } as const` |
| `FOOTER_MISSION` | `'A national coordinating body for affiliated orchid societies across South Africa — promoting culture, hybridisation and appreciation of orchids in cultivation since 1968.'` |
| `FOOTER_REG` | `'REG# 1978/004040/08   NPO 043-901'` (one source line: f6-home-fidelity greps `REG#.*NPO`) |
| `FOOTER_BULLETIN` | `{ text: 'Quarterly bulletin — show dates, judging results and yearbook news.', inputLabel: 'Email address', placeholder: 'your@email.co.za', submit: 'Subscribe' } as const` |
| `FOOTER_WILD` | `{ heading: 'Looking for wild orchids?', label: 'Visit Wild Orchids of Southern Africa →', href: 'https://wildorchids.co.za' } as const` |
| `FOOTER_LEGAL` | `[{ id: 'privacy', label: 'Privacy', href: '/privacy' }, { id: 'terms', … '/terms' }, { id: 'refunds', … '/refunds' }, { id: 'constitution', … '/constitution' }, { id: 'media-kit', label: 'Media kit', href: '/media-kit' }] as const` |
| `FOOTER_COPYRIGHT` | `' South African Orchid Council. All rights reserved.'` (leading space, see 5.3) |

Values only: literals, no identifiers, no template interpolation.

### 5.2 SAOC render: unchanged bytes

Footer.tsx renders from those constants with every class name, element and attribute exactly as
now. A9 compares the HTML byte for byte.

### 5.3 The `<!-- -->` hazard

React's server renderer puts `<!-- -->` between adjacent text nodes. Today the copyright span is
three nodes: `"© "`, `{year}`, `" South African Orchid Council. All rights reserved."`. Render it
as `&copy; {new Date().getFullYear()}{FOOTER_COPYRIGHT}`: still three nodes, same bytes. Writing
`{year} {name}. All rights…` adds nodes and fails A9. Each other text (`{FOOTER_MISSION}`,
`{FOOTER_REG}`, headings, labels) is a single expression replacing a single JSX text node, so its
bytes are unchanged.

### 5.4 `components/nos-chrome/NosFooter.tsx` (`'use client'`)

Imports the constants from `'@/components/chrome/Footer'`, `partners` from `'@/lib/data'`,
`NOS_LOCKUP_ALT` from `./menu`. Retypes none of the copy. Target markup (from build.py `footer()`):

```html
<footer class="nf">
  <div class="nf-wrap">
    <div class="nf-grid">
      <div class="nf-brand">
        <a class="nf-lockup" href="/national-show" aria-label="{NOS_LOCKUP_ALT}, National Show home">
          <img class="nf-h" src="/images/nos/chrome/nos-reversed-horizontal-1200.png" alt="{NOS_LOCKUP_ALT}" width="1200" height="294" loading="eager">
          <img class="nf-v" src="/images/nos/chrome/nos-reversed-white-vertical-900.png" alt="{NOS_LOCKUP_ALT}" width="900" height="791" loading="eager">
        </a>
        <div class="nf-org">
          <h2 class="nf-head">South African Orchid Council</h2>
          <p class="nf-text">{FOOTER_MISSION}</p>
          <span class="nf-reg">{FOOTER_REG}</span>
        </div>
      </div>
      <div class="nf-col"><h2 class="nf-head">{FOOTER_HEADINGS.explore}</h2><ul class="nf-list">{FOOTER_NAV: <li><a href>{label}</a></li>}</ul></div>
      <div class="nf-col"><h2 class="nf-head">{FOOTER_HEADINGS.partners}</h2><ul class="nf-list">{partners: <li><span>{name}</span></li>}</ul></div>
      <div class="nf-col nf-col-touch">
        <h2 class="nf-head">{FOOTER_HEADINGS.touch}</h2>
        <p class="nf-text">{FOOTER_BULLETIN.text}</p>
        <form class="nf-form" onSubmit={(e) => e.preventDefault()}>
          <input type="email" aria-label="{inputLabel}" placeholder="{placeholder}" required>
          <button type="submit">{submit}</button>
        </form>
        <div class="nf-wild"><h2 class="nf-head">{FOOTER_WILD.heading}</h2><a href="{href}" target="_blank" rel="noopener noreferrer">{label}</a></div>
      </div>
    </div>
    <div class="nf-base"><span>&copy; {new Date().getFullYear()}{FOOTER_COPYRIGHT}</span><div class="nf-legal">{FOOTER_LEGAL: <a href>{label}</a>}</div></div>
  </div>
</footer>
```
- Lockups: `next/image` with `unoptimized` (the files are the final Lanczos sizes; never resampled
  again) and `loading="eager"`. Two `<img>`, switched by CSS; never `<picture>`.
- Internal links via `next/link`, as Footer.tsx does.
- "South African Orchid Council" is HANDOFF decision 10's organisation label: a literal is allowed.
- Not carried: any "An event of the South African Orchid Council" line.

## 6. Stylesheet: `components/nos-chrome/nos-chrome.css`

Ship `goldens/nos-chrome.golden.css` as is. It is chrome.css with exactly two changes:
1. the `.np` proposal-pill rules are gone;
2. `--nc-serif`/`--nc-sans` move from `:root` to `.nh, .nd, .nf` and read
   `var(--font-nos-fraunces)` / `var(--font-nos-karla)` first. next/font publishes hashed family
   names, so the literal "Fraunces"/"Karla" would never match, and a `var()` inside a custom
   property resolves where it is declared (`:root` sits above `.nos-theme`, which holds the
   font variables).

A2 compares every (at-rule, selector, property, value) of the shipped file with the reference;
anything added, dropped or changed fails. Do not convert it to Tailwind or a CSS module: the class
names are the contract with the markup in §5.4 and §9. No class collisions exist (`nh-`, `nd-`,
`nf-`, `nc-` are unused at 5ae1f3cf). It loads only on NOS routes (imported by the national-show layout).

## 7. Lockup files

`scripts/build-nos-chrome-lockups.py` (Python 3 + Pillow, committed; precedent:
`scripts/generate-saoc-emblem-web-assets.py`). Codi's own recipe from build.py, unchanged:
`Image.open(master).resize((W, round(H * W / w)), Image.LANCZOS).save(out, optimize=True)`.

| Master (read only, `branding/National Show 2027/Logo/`) | Output (`public/images/nos/chrome/`) | Size | Ink box |
|---|---|---|---|
| `NOS-2027-logo-full-colour-horizontal.png` (4108×1008) | `nos-full-colour-horizontal-1200.png` | 1200×294 | (54,54)–(1139,241) |
| `NOS-2027-logo-full-colour-reversed-horizontal.png` (4108×1008) | `nos-reversed-horizontal-1200.png` | 1200×294 | (54,54)–(1139,241) |
| `NOS-2027-logo-reversed-white-vertical.png` (3272×2876), the mono tone file Brad approved | `nos-reversed-white-vertical-900.png` | 900×791 | (61,59)–(834,723) |

Verified 2026-10-15: the masters' sizes and alpha boxes match HANDOFF, and this recipe produces
exactly those ink boxes. Never crop, trim, recolour, typeset or redraw. A1 checks size, ink box,
pixel-equality (±2/255) with a fresh Lanczos downscale of the named master, the generator, and
that the masters are untouched.

## 8. Hub hero

### 8.1 `app/(marketing)/national-show/page.tsx`: minimal, rebase-safe

fix/nos-audit-p1 edits only the hero "Book tickets →" href (base line 572). This feature may only
change base line 3, lines 74–156 and lines 514–522 (A7 enforces it):
- delete `import { getImageProps } from 'next/image';` (line 3);
- delete the `HERO_LOCKUP_*` constants, their doc comment and `HeroLockup()` (lines 74–156);
- in `<NosHero …>` (lines 514–522): delete `eyebrow="The Flagship"`, the lockup comment and
  `eyebrow2={…}`; set `title={getNosMenu().lead.label}`; keep `titleSize="display"`;
- add `import { getNosMenu } from '@/components/nos-chrome/menu';` among the imports (insertion).

Kept, untouched: `HERO_LEDE`, `HERO_FOCAL_POINT`, the four facts (Dates / Host / Venue / Cycle),
the ConfirmationBadge, the three CTAs (Book tickets →, Register interest, Find your society; see
D4) and the countdown. `toRomanOrdinal` stays (the cycle and past-edition cards use it).

### 8.2 `components/nos/NosHero.tsx`: `display` branch only

The default branch (the other heroes) stays byte-identical (A7 compares base lines 147–214 and
277–306). Remove the `eyebrow2` prop and its docs (its one call site is gone); the display branch
renders no eyebrow. Values from HANDOFF "Hub hero" and build.py's hub CSS:

| Element | >700px | ≤700px (R4) |
|---|---|---|
| section | `min-height: clamp(600px, calc(100svh - 97px), 820px)`; ground `#0B0A14` (`--black`, never purple); keeps `nos-on-dark`, `overflow-hidden` | `flex-direction: column; min-height: 0` |
| photo box | `position: absolute; inset: 0 0 0 22%`; `mask-image` and `-webkit-mask-image: linear-gradient(90deg, transparent 0, #000 16%)`; image `object-fit: cover`, `object-position` = `focalPoint` (68% 50%) | in flow, `order: 2` (below the copy), `aspect-ratio: 4 / 3`, no mask, `object-position: 64% 50%` |
| scrim | one layer: `linear-gradient(90deg, rgba(11,10,20,.94) 0%, rgba(11,10,20,.92) 30%, rgba(11,10,20,.8) 44%, rgba(11,10,20,.4) 58%, rgba(11,10,20,.14) 78%, rgba(11,10,20,.04) 100%)` | none (the copy sits on solid black) |
| copy column | `justify-content: flex-end`; `padding-block: 72px 56px`; `gap: 28px` between the h1 and the existing copy block | `padding-block: 40px; gap: 32px` |
| h1 | text; `font-family: var(--font-nos-fraunces)`; `font-weight: 300`; `font-variation-settings: 'opsz' 96`; `font-size: clamp(3.2rem, 2rem + 4vw, 5.5rem)`; `line-height: 1`; `letter-spacing: -0.01em`; colour `#FBFAF0`; `max-width: 11ch`; `margin: 0`; `data-nos-hero-text="title"` | `font-size: clamp(2.8rem, 12vw, 3.4rem)` |

Delete the old display scrim (0.94/0.80/0.44/0.18/0.04), the ≤620px flat `rgba(11,10,20,0.82)`
layer and every 620px breakpoint. The existing copy block (lede, facts, actions) keeps its own
styles. The breakpoint is 700px (`max-[700px]:`), as HANDOFF writes it for the hero; the header's
own breakpoints stay 699/1260 as chrome.css writes them.

### 8.3 `scripts/checks/nos-hero-contrast.mjs`

In `REQUIRED_TEXT_LABELS`, replace `'eyebrow', 'eyebrow2'` with `'title'`. Nothing else. It is the
tool for browser check B5.

## 9. Header markup and behaviour: `components/nos-chrome/NosHeader.tsx` (`'use client'`)

Props: `{ show?: ShowIdentity | null }`. Reads `usePathname()`. All labels from `getNosMenu()`, meta
from `showMenuMeta(show)`, alt from `NOS_LOCKUP_ALT`. Target SSR markup (closed; from build.py
`header()`), rendered as a fragment:

```html
<span class="nh-sentinel" id="nh-sentinel" aria-hidden="true"></span>
<header class="nh" id="nh">                       <!-- + " is-scrolled" once the sentinel leaves the viewport -->
  <div class="nh-bar">
    <a class="nh-brand" href="/national-show" aria-label="{NOS_LOCKUP_ALT}, National Show home" [aria-current="page" on /national-show]>
      <img src="/images/nos/chrome/nos-full-colour-horizontal-1200.png" alt="{NOS_LOCKUP_ALT}" width="1200" height="294">   <!-- next/image, unoptimized, priority -->
    </a>
    <nav class="nh-nav" aria-label="Primary"><ul>
      <li><a class="nh-link" href="/about">About</a></li> … Members
      <li class="nh-show" id="nh-show">
        <button class="nh-trigger" type="button" id="nh-show-trigger" aria-expanded="false" aria-controls="nh-mega" data-current="">
          <span class="nh-label">National Show</span><svg class="nc-chev" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="nh-mega" id="nh-mega" hidden>
          <div class="nh-mega-grid">
            <div class="nh-mega-lead">
              <a class="nh-mega-lead-link" href="/national-show" [aria-current]>{lead.label}</a>
              <span class="nh-mega-meta">{meta.lead}</span>
              <h3 class="nh-mega-head">The Show</h3>
              <ul class="nh-mega-list"><li><a href="…" [aria-current]><span class="nh-leaf">{label}</span><span class="nh-desc">{descriptor}</span></a></li>…</ul>
            </div>
            <div class="nh-mega-col"><h3 class="nh-mega-head">{heading}</h3><ul class="nh-mega-list">…</ul></div>   <!-- Visit, Programme, Exhibit & Trade -->
            <div class="nh-mega-rail">
              <span class="nh-mega-meta">{meta.rail}</span>
              <h4>{rail.heading}</h4>
              <ul class="nh-mega-list"><li><a href="/tickets/day-visitor"><span class="nh-leaf">Day Visitor</span></a></li><li>… Weekend Pass</li></ul>
            </div>
          </div>
        </div>
      </li>
      <li><a class="nh-link" href="/sponsors">Sponsors</a></li>
    </ul></nav>
    <a class="nh-cta" href="/national-show/tickets" [aria-current="page" on /national-show/tickets]>Tickets</a>
    <button class="nh-burger" type="button" id="nh-burger" aria-expanded="false" aria-controls="nd">
      <svg class="is-bars" …><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
      <svg class="is-x" …><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      <span class="nh-burger-label">Menu</span>
    </button>
  </div>
</header>
<div class="nd" id="nd" hidden>
  <nav class="nd-inner" aria-label="Menu"><ul class="nd-list">
    <li><a class="nd-item" href="/about">About</a></li> … Members
    <li>
      <button class="nd-item" type="button" aria-expanded="false" aria-controls="nd-show" data-current="">National Show<svg class="nc-chev" …/></button>
      <div class="nd-sub" id="nd-show" hidden>
        <div class="nd-lead"><a href="/national-show" [aria-current]>{lead.label}</a><span>{meta.lead}</span></div>
        <div class="nd-group"><h3>{heading}</h3><ul><li><a href="…" [aria-current]><span class="nh-leaf">…</span><span class="nh-desc">…</span></a></li></ul></div>   <!-- ×4 -->
        <div class="nd-group"><h3>{rail.heading}</h3><ul><li><a href="/tickets/day-visitor"><span class="nh-leaf">Day Visitor</span></a></li>…</ul></div>
      </div>
    </li>
    <li><a class="nd-item" href="/sponsors">Sponsors</a></li>
    <li><a class="nd-item" href="/contact">Contact</a></li>
  </ul></nav>
</div>
```
`aria-current="page"` goes on every leaf/lead link whose href equals the pathname. Omit a meta
`<span>` when its value is null. Internal links via `next/link`.

Behaviour, ported from chrome.js into React state and effects (not pasted):
- **Elevation:** an IntersectionObserver on `#nh-sentinel` toggles `is-scrolled` on the header.
- **Mega (click only, R12):** the trigger toggles it; never on hover. Closes on Escape (focus back
  to the trigger), on focus leaving `li#nh-show` (`focusout` whose `relatedTarget` is outside it),
  on a `mousedown` outside `li#nh-show`, and on a click on any link inside it. `aria-expanded`
  mirrors the state; `hidden` on `#nh-mega` when closed.
- **Menu panel (<1260):** the burger toggles it; label "Menu"/"Close", `aria-expanded` in sync.
  On open: if the header's computed `position` is not `sticky` (phones), remember `scrollY` and
  scroll to the top; set `inert` on every element sibling of the header and the panel (the
  sentinel, `main`, the footer) and on every `body` child that does not contain the header,
  skipping `SCRIPT`; `document.body.style.overflow = 'hidden'`; set the panel's `style.top` to
  `max(0, header.getBoundingClientRect().bottom)` px; focus the first visible link or button in
  the panel (useLayoutEffect, so it lands before paint). On close: undo all of it and restore the
  scroll position if one was saved. Escape closes it and calls
  `burger.focus({ preventScroll: true })`. A link click inside it closes it without restoring
  the scroll. It closes when `matchMedia('(min-width: 1260px)')` starts matching. The accordion
  button toggles its own `aria-expanded` and `#nd-show`'s `hidden`.
- **Route change:** when the pathname changes, close the mega and the panel (adjust during render,
  as Header.tsx does).
- Clean up every listener and observer on unmount, and remove any `inert`/overflow left behind.
- Not ported: the deep-link hash redirect and the proposal pill.

## 10. Deletions (orphaned by this feature)

- `components/nos/NosMasthead.tsx`, `components/nos/Logo.tsx` (their only users were the
  national-show layout and each other).
- `public/images/nos/lockup/NOS-2027-logo-full-colour-reversed-horizontal.png` and
  `…-vertical.png` (the retired hero lockup).
- `scripts/checks/nos-hero-paint-probe.mjs` (it measures the deleted lockup files).

Superseded by design: the nos-hero-lockup F1 hero (lockup as h1, eyebrow, edition line, 620px
scrim) and the NOS masthead/colophon bands. Their old checks are historical. One older
SAOC-contract grep also goes red: contract-policy-pages greps Footer.tsx for the literal
`href="/privacy"`, which becomes `href: '/privacy'` in `FOOTER_LEGAL` (see D5). The rendered
footer is unchanged and A9 proves it.

## 11. Decisions needed (a recommendation is applied in each case, so work does not stall)

- **D1 Rail anchors** (§3.4). Applied: product pages `/tickets/day-visitor` and
  `/tickets/weekend-pass`, no ids. Alternative: build the v13 tickets cards first (new design work,
  out of scope).
- **D2 Fonts.** HANDOFF's acceptance check says "only Fraunces and Karla are loaded". On the real
  site the root layout loads Crimson Pro, Manrope and JetBrains Mono for every page, and the
  national-show layout loads Cormorant Garamond and Jost for the NOS page bodies. Applied: the
  chrome and the hub h1 use only Fraunces and Karla; the page bodies and the root layout are
  untouched. Switching the NOS body type to R14 is the open R14 question already in the backlog
  ("confirm the R14 fonts with Brad before beta"). Alternative: widen this mission to the body type.
- **D3 ShowBand.** `components/home/ShowBand.tsx` renders only on the SAOC home page (`/`), not on
  any NOS route, and HANDOFF says nothing about it: the NOS bands this header replaces are the
  NOS masthead and colophon (§10). Its reported 768px overflow is a SAOC-route visual with no
  HANDOFF value to apply (the source arithmetic does put the four countdown cells, about 336px,
  into a 256px box at 768). Applied: not in F1. Recommend a separate lead-owned fix with a measured
  repro. Alternative: an F2 here, which would need a visual decision this handoff does not give.
- **D4 Hero CTAs.** HANDOFF lists "Plan your visit and Find your society"; the code has "Book
  tickets →", "Register interest" and "Find your society". Applied: keep the code's three
  untouched (the lead's instruction; fix/nos-audit-p1 edits the first). Alternative: bring the
  CTAs in line with HANDOFF in a follow-up after fix/nos-audit-p1 lands.
- **D5 Old greps.** contract-policy-pages' `href="/privacy"` grep on Footer.tsx goes red when the
  legal links move into `FOOTER_LEGAL`. Applied: supersede it (the rendered footer is
  byte-identical, which A9 proves). Alternative: keep the legal JSX inline in Footer.tsx and
  duplicate the list for NOS, which forks the copy.

## 12. Browser checks for the orchestrator (Canary, 1280×800 and 390×844; dev server on :3016)

Static and server-HTML checks cover the rest; these need a real browser.

| # | Check | Pass |
|---|---|---|
| B1 | Logo count, every NOS page tested (hub, tickets, faq, symposium, vendors) | one NOS logo in the viewport at the first screen (the header's); header + footer both visible only while the footer is on screen; no logo in hero, mega or panel |
| B2 | Lockup sizes | header img 448px at 1280 (cap ≥7px), 390px at 390 and 700px wide (cap ≥6px); at 360 it fills the row (`min(390px, (100vw − 32px)/0.904)`); footer 448px horizontal at 1280, vertical 342px (`min(342px, 100%)`) at 390; natural aspect ratio; ink never clipped (the header bar is 97px tall ≥700, 146px ≤699) |
| B3 | Bar layout by width | ≥1260 one row; 700–1259 lockup · Tickets · Menu; ≤699 two rows, header not sticky |
| B4 | Type floor and targets | no text <12px except visually hidden labels; every link, button and input ≥44×44 except inline links in running copy |
| B5 | Hero contrast | `NOS_HERO_CONTRAST_URL=http://localhost:3016/national-show node scripts/checks/nos-hero-contrast.mjs` passes: ≥4.5:1 at the brightest composited pixel (reference: 4.71 min at 1280, ≥15.48 at 390) |
| B6 | No horizontal scroll at 390 on every NOS page | `document.documentElement.scrollWidth === innerWidth` |
| B7 | Fonts | computed `font-family` of header, panel, footer and hub h1 resolves to Fraunces/Karla only (see D2) |
| B8 | Console | no errors on any NOS page and on `/`, `/about` |
| B9 | Keyboard: mega | opens by click or Enter, never on hover; Escape closes it and focus returns to the trigger; focus leaving closes it; `aria-expanded` in sync |
| B10 | Keyboard: panel | opening makes `main` and the footer inert and locks body scroll; focus lands on the first item; Escape closes it, focus returns to Menu, scroll position kept; at 390 opening scrolls to top and closing restores; crossing 1260 closes it; accordion `aria-expanded` in sync |
| B11 | `aria-current` | the current leaf on /national-show/faq; the Tickets CTA on /national-show/tickets (outline style); the brand on the hub |
| B12 | Rail | Day Visitor and Weekend Pass open /tickets/day-visitor and /tickets/weekend-pass (D1) |
| B13 | SAOC regression | `/`, `/about`, `/sponsors`, `/tickets`, `/events` still show the SAOC UtilityBar, header with the full-name lockup and footer; SAOC mobile menu opens at 390 |
| B14 | Client navigation | `/about` → National Show (via the SAOC mega) shows the NOS chrome with no SAOC chrome left; NOS → Sponsors (via the NOS nav) restores the SAOC chrome; no duplicate `<main>` |

## 13. Named gaps (not filled)

- The v13 tickets page with Day Visitor/Weekend Pass cards is not built (D1).
- NOS page body type is still Cormorant/Jost (D2).
- HANDOFF's hero CTA set differs from the code's (D4).
- The RSC payload of a NOS page still carries the (unrendered) UtilityBar's server output, because
  the marketing layout renders it before the client gate decides. Nothing reaches the DOM; no
  SAOC image is requested.
