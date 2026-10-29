# SAOC design consistency (mission backlog-wave-2026-10-28)

Five features that bring the SAOC host (not the NOS host) to one set of rules: status tokens, one focus ring and one error-summary style (F1a), a desktop nav that fits at 1280 (F1b), one h2 role and one inner-hero height (F1c), an AVIF-first priority hero (F1d), and a shorter mobile critical path with SVG glyphs (F1e). The rulings are NOS Design's, recorded in `comms.md` ("rulings on MERGED.md", "SA-6: /about hero at 1024 and 1280", "LCP critical-path levers", "F1e: favicon source and glyphs", and the SA-1 acceptance). Rules: [`docs/rules/no-invention.md`](rules/no-invention.md).

Status at writing (spec branch `c3dfa256`): all five features have code on their feature branches (`feat/sdc-f1a-tokens-focus` through `feat/sdc-f1e-critical-path`). Each is checked by its contract under `.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/`, and the checks were run against local builds while the branches were written. Nothing is merged to main or deployed; the phase 5 beta checks (listed under [Phase 5](#phase-5-checks-still-to-run-after-deploy)) have not run. Where this doc says "as built", it means as built on the feature branch.

Spec, contracts, goldens and checks: `.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/`. Proof that the checks fail on `origin/main` (48d74378): `goldens/proof-on-main.md`, which carries dated amendments; where an amendment and an earlier line differ, the amendment wins.

## F1a: status tokens, one focus ring, breadcrumb targets, newsletter field

**Status tokens.** `app/globals.css` `:root` defines `--status-error #8f2834`, `--status-success #2f5d3a`, `--status-warning #7a5a12`. Before this, `--status-error` was referenced by `components/vendors/*` but defined only in `app/(nos)/national-show/nos-theme.css`, so on the SAOC base it resolved to nothing. Contrast on parchment is 7.49, 6.87 and 5.72. Used only as text plus icon, never colour alone (success sits close to the `--primary` sage, which is why the icon is binding). Error summaries use the same token as a 2px border (`border-2 border-[var(--status-error)]`), no tint, with an `aria-hidden` `CircleAlert` icon beside the text (`VendorApplyForm`, `VendorRegistrationCodeEntryForm`). The vendor forms render only on the NOS host, so the SAOC-host guarantee is the token itself plus the static check `check-error-summary-static.mjs`.

**One focus ring.** 2px solid, offset 3px. Ivory on dark grounds (hero, footer), `--primary` on parchment (header, breadcrumb). The reference is the Home hero CTA ring in `components/home/Hero.tsx`. It replaces three older treatments: the 2px underline on footer and CTA links (NAV-1, [`nav-focus-underline.md`](nav-focus-underline.md)), `ring-2` on Menu and the lockup, and `outline-none` on Join. The underline stays gone from those controls; the NAV-1 route-focus and `aria-current` work is untouched.

The outline colour is also set unconditionally (`outline-ivory` or `outline-primary` with no `focus-visible:` prefix on the hero CTAs, Join and Menu). Those controls carry `transition-colors`, which animates `outline-color` from `currentColor` on focus. With the colour set only under `focus-visible:`, the ring starts as the text colour and fades to the right one, so a check (or an eye) reading it early sees the wrong colour. An earlier "hero CTA ring 1.42:1" reading in the proof was exactly that artefact. `check-focus-ring.mjs` now waits for `document.getAnimations()` to finish plus a 300 ms floor before reading computed styles.

The check measures contrast from pixels, not from computed backgrounds: it hides the outline, screenshots a band 2 to 6px outside the element box (the ring paints 3 to 5px out) and takes the worst case of the settled ring colour against those pixels, so photographs and scrims count. A target whose ring box (element plus 5px) is clipped by the viewport on any side fails rather than skips.

**Breadcrumb targets.** `components/chrome/Breadcrumb.tsx` links are `inline-flex min-h-6 min-w-6 items-center`, so each is at least 24x24 (Home was 37x19). The breadcrumb link ring is the same ring.

**Newsletter field.** On main the footer field measured 3.00:1 (placeholder `ivory/40`) and 1.85:1 (border `ivory/20`) against the `#22281f` ground. Now the placeholder is `ivory/75` (needs 4.5:1) and the border is `--accent-soft` (needs 3:1). No new colour; `check-no-new-colours.mjs` guards that no hex literal is added outside the three status values.

### Where the one ring applies, and the allowlist

Ruled scope (revised): **all standalone actions and all form controls on SAOC surfaces** take the one ring: outline 2px solid, offset 3px, an outline colour, no `ring-*` utility and no `outline-none`. That covers buttons, links, CTAs, the logo, drawer close, search and Join, admin header actions, submit buttons, the equipment tables' add/remove-row buttons and cell inputs, text inputs, selects, checkboxes, radios, and error-summary wrappers with `tabIndex={-1}`. Colour is `--primary` on light grounds and ivory on dark grounds (hero, footer). NOS-host-only code (`components/nos-chrome/`, `components/nos/`, `components/show/`, `components/tickets/TicketTypeCard.tsx`, `app/(nos)/`) is out of scope.

`check-focus-classes-static.mjs` enforces it. It enumerates every `className` string under `app/` and `components/` (`.ts` and `.tsx`) that carries `focus:ring-*`, `focus-visible:ring-*`, `ring-offset-*`, any `outline-none` (bare, `focus:` or `focus-visible:`) or a focus `outline-offset` other than `[3px]`. A hit passes only if it is the one ring, or it is listed in `goldens/focus-classes.json`. A bare `outline-none` is the only way to remove a browser default ring, so it must sit in the same class string as the one ring or be allowlisted; `focus:` or `focus-visible:` `outline-none` is never allowed beside the one ring. Each allowlist entry names a file and a substring of the className, one entry per component and never a glob, and an entry that matches no hit fails the check (stale). Cues that are not an outline or ring (group-focus underline, `focus-visible:bg-*`, `focus:border-*`, the AdminShell skip link's `focus:bg-*`) are ignored, not listed.

The allowlist, with the reason recorded for each:

| Entry (file) | Why it is exempt |
|---|---|
| NAV-1 underline links: the Header nav items (`components/chrome/Header.tsx`) and the MobileMenu drawer nav rows (`components/chrome/MobileMenu.tsx`) | The nav design's own underline focus ruling ([`nav-focus-underline.md`](nav-focus-underline.md)); F1b owns the nav. |
| Admin `FOCUS_RING_ON_DARK` (`components/admin/tokens.ts`, `focus-visible:outline-offset-[-4px]`) | Codi ruling: an inset ring on dark table headers (inset -4px, `accent-soft`), because an outset ring would clip there. |
| Provider sign-in buttons: `GoogleSignInButton`, `AppleSignInButton`, `MicrosoftSignInButton` under `app/admin/login/` (three entries) | Third-party brand buttons whose className carries the provider's brand hex values (tracked by `check-no-new-colours.mjs`, A6). Admin-only. |
| Script-focused headings: `ContactForm`, `SponsorEnquiryForm`, `SponsorEnquirySection` (both its document and standalone branches) | Non-interactive headings that script focuses so a screen reader announces the result; nothing a keyboard user tabs to. |
| `EventCard` row link (`components/events/EventCard.tsx`) | NAV-1-family underline focus: the title underlines and a 2px left bar shows. |
| `SocietiesClient` search (`app/(marketing)/societies/SocietiesClient.tsx`) | The input's own outline is removed, and the wrapper carries the ring through `focus-within`. |

### What check-focus-ring.mjs probes at runtime

`check-focus-ring.mjs` focuses each target, waits for animations plus the 300 ms floor, then reads geometry (2px solid, 3px offset) and measures the ring against pixels as above. Targets, by route and width:

- Home at 1440 (deployed only, Home does not render under fixtures): the hero CTA, the reference ring.
- `/about` at 1440: header logo, Join, header search button, footer lockup, an Explore link, a legal-bar link, the media-kit link (admin-only, skipped when absent), and the search overlay's query input and first result link. Results come from `/api/societies/search` (live Sanity), so on a fixture build the result link prints a KNOWN GAP and is covered by the deployed run.
- `/about` at 1100: Menu. `/about` at 390: the open drawer's own "Join a society" link (not the header Join, which a phone keyboard user never lands on), and the drawer's close (`button[aria-label="Close menu"]`) and search (`[data-hd=drawer-search]`) controls.
- The seven chrome controls added in `009fd661` after Codex found the footer newsletter submit had no ring: header search button, footer newsletter submit (on `/about` and `/judging`, because the footer renders per route; the probe waits for it to enable after hydration), newsletter email input, newsletter topic checkbox, drawer close and drawer search.
- Controls on the dark footer must show a light ring: red, green and blue channels all at least 220 (ivory), in addition to the 3:1 pixel test.

### Error summaries

The golden style is `border-2 border-[var(--status-error)]`, an `aria-hidden` icon beside the text, text in `--status-error`, **no background tint**. Every alert under `app/` and `components/` (`role="alert"`, `role={...'alert'...}` or `aria-live="assertive"`; NOS chrome in `components/nos-chrome/` excluded) is classified in `goldens/alert-classes.json`, and `check-error-summary-static.mjs` enumerates each instance and forbids a tint. Unlisted alerts default to class (a), so a new alert must carry the golden style or be classified. An entry that matches no alert fails (stale).

| Class | Meaning | Listed today |
|---|---|---|
| (a) | Error summary or page-level error: the golden style in full. The default. | everything not listed below |
| (b) | Field-level alert of a named allowed kind | `TicketFormField` (`TicketFieldAlert`: left-border-only, transparent, aria-hidden warning sign, error text); the footer newsletter topics error (`NewsletterSignup`, left-border-only or its sr-only mirror, tied to the fieldset by `aria-describedby`); `PaymentSettingsPanel` `ErrorText` (inline, aria-hidden icon, error text colour); `DoorResultBanner` (the door scan result panel, role status when valid and alert when refused; its result colours belong to the door-scanner design, so restyling is out of F1a's scope); `VendorMarketingUploadField` (upload field error, allowed only with an aria-hidden icon beside `--status-error` text, enforced by `requireIconAndToken`) |
| (c) | Not an error (a status notice) | none yet |

## F1b: desktop nav from 1280 (SA-1)

NOS Design's rule: the inline nav shows from the smallest width where logo, nav and CTA fit on one row with 24/12 gaps and 32px side padding, and that width must be at most 1280. Measured natural widths are in `goldens/nav-widths.md` (logo 405, seven items 635.59, Join 168.36). Seven items do not fit at 1280 (1244.95 needed, 1216 available). Six items plus a 44px control still miss by 7.85px. The confirmed layout:

| Width | Layout |
|---|---|
| below 1280 | Menu only, labelled (unchanged) |
| 1280 to 1383 | 5 inline items (About, Societies, Judging & Awards, Events, National Show), Join, icon-only Menu. Sponsors and Contact and Search live in the drawer |
| 1384+ | 7 inline items, search, Join, no Menu (unchanged) |

The six-item variant (fits from 1296) was rejected because it breaks the 1280 rule.

How it is built in `components/chrome/Header.tsx`:

- The nav wrapper is `hidden min-[1280px]:block`. Sponsors and Contact stay in the DOM and are hidden by CSS only (`min-[1280px]:max-[1384px]:hidden`, `DEMOTED_CLASS`), so the same markup gives 5 visible items at 1280 to 1383 and all 7 at 1384+. Tests count `[data-hd="item"]:visible`.
- **Tailwind v4 trap:** `max-[X]` means width **less than** X, not at most X. "Hidden through 1383" is therefore `max-[1384px]`. Writing `max-[1383px]` would show seven items at exactly 1383 and overlap the CTA.
- The Menu button is icon-only from 1280 (`min-[1280px]:min-w-11 min-[1280px]:px-0`, label `sr-only`), `aria-label="Menu"` at every width (it was "Open menu"), target at least 44x44, hidden from 1384. Tests select `getByRole('button', { name: 'Menu', exact: true })`; `exact` stops "Close" or other names containing "menu" matching.
- The Join CTA's `ml-auto` switches off at `min-[1280px]:ml-0`.
- The drawer lists all seven destinations plus Search, and `aria-current="page"` sits on the drawer item for /sponsors and /contact (existing `navAriaCurrent` wiring, guarded by `check-nav-drawer-current.mjs`). NOS Design ruled the Menu button itself gets no current-page marker: an underline would claim Menu is the page and a dot reads as a notification.

Gates at 1280 and 1383: one row, `logo.right + 24 <= nav.left`, at least 12px between nav, Join and Menu, `scrollWidth == clientWidth`, logo stays 405px (`check-nav-one-row.mjs`, `check-nav-spacing.mjs`, `check-nav-reach.mjs`).

Merge note: F1a and F1b both edit the Join CTA and Menu class strings in `Header.tsx`. The merged result carries F1b's width classes (`min-[1280px]:ml-0`, `min-[1280px]:min-w-11 min-[1280px]:px-0`) and F1a's one ring (outline 2px solid, offset 3px, `outline-primary`).

## F1c: h2 role, Title role, hero heights and facts

**H2 role (landed, 553fe5e9).** Serif (Crimson Pro), weight 300, `--h2-role: clamp(32px, 29px + 0.762vw, 44px)` (32 at 390, 39.97 at 1440, 44 at 2056), line-height 1.15. Defined in `app/globals.css` and applied through `.h2` and `.doc-h2`, scoped `:not(.nos-theme *)` so the NOS host keeps its own scale. Section h2s that carried their own clamp (`MissionBlock`, `ShowBand`, `NavCards`, `EventsStrip`, `YearbookStrip`, `CTASection`, `SponsorEnquirySection`, vendor intro and empty state) now use `text-[length:var(--h2-role)] leading-[1.15]`.

**Title role.** For card-type h2s: serif 400 at 20 to 22px (for example `MonthGroup` month heads went from 24px to 22px). The hero h1 is untouched, and Brad's display-weight 300 ruling stays.

Gate: `check-h2-roles.mjs`, every main h2 is the H2 or Title role at 390, 1440 and 2056. It failed 150 times on main locally (186 on beta, which includes Home and Events).

### Hero heights

Inner `PageHero` is 480 +-4 on the eight non-exempt routes (/about /judging /sponsors /members /memorandum-of-incorporation /privacy /terms /refunds). Exempt: Home, Events list, Societies grid, Contact, 404, and /media-kit (a gated tool page with a typographic header, not asserted to have a `PageHero`). The locks, all including /about:

| Widths | Gate | Status |
|---|---|---|
| 768, 1440, 2056 | A2 `check-hero-heights.mjs`, 480 +-4 | passes on main, a lock |
| 1024, 1280 | A8 `check-hero-heights-report.mjs`, a hard lock | red on main (/about 496 and 545) |
| 769, 880, 960, 1023 | A14 `check-about-tablet-band.mjs`, see the exception below | a guard: not proven failing on main (it would need a main production build); passes on F1c dev `271aacfc` |

NOS Design accepted /about at 1024 by eye, so the earlier fallback (CASE B, a 516 allowance at 1024) is removed; there is no loosened tolerance. Below 768 height is content-driven and not gated; `check-hero-mobile-anatomy.mjs` (A7) instead asserts one photo-band aspect ratio (`aspect-[2/1]`) and one copy-block padding (`py-10`, `md:py-16`) on every route.

### Hero facts: why /about was tall, and the bands

Cause: /about's `dl[data-hero-facts]` needs about 600px (dt 26ch, gap 40, dd 32px) in a copy column of about 570px at 1280 and 450px at 1024, so the row wrapped to 545 and 496. NOS Design ruled one facts row, no copy change, no facts moved out of the hero, with levers set globally in `.hero-facts` in `app/globals.css`, never per route. The first ruling set 18ch at 768-1279; ruling option (b) (final) narrowed it to 14ch at 1024-1279 only, which is what holds /about on one row at 1024. The result, the single source for the checks and this doc:

| Viewport | Column gap | dt max-width |
|---|---|---|
| 768-1023 | 24 | 18ch |
| 1024-1279 | 24 | 14ch |
| 1280-1439 | 24 | 18ch |
| 1440 and up | 40 | 26ch |

- dt wraps balanced, at most 3 lines. dd has a 24px floor and the weight band: serif 300 from 32px, 400 from 24 to 31.99px (before this, dd was 300 at every size on every SAOC hero, which broke Brad's weight rule below 32px).
- **dd is `white-space: nowrap` on the centred variant only.** The start-aligned variant (`data-facts-align="start"`, the event facts) may wrap values at spaces, so only the centred row holds each dd on one line.
- The levers are scoped `:not(.nos-theme *)` (dce76fb5): the NOS hero reuses `.hero-facts` and keeps its own scale.
- Not allowed: widening the 48% copy column or shrinking the scrim (clear to 44%, full by 52%, alpha 0.8). `check-hero-facts-row.mjs` (A9) asserts the 768, 1024 and 1280 rows of the table, plus one row at 1024 and 1280 (dd tops within 1px), no overflow, every dt at most 3 lines, and column and scrim unchanged. The 1440-and-up row and the 769-1023 interior are documented here and covered by A14 only for rows, breaks, overflow and height. `check-hero-dd-weight.mjs` (A10) asserts the weight band at 390, 768, 1024, 1280, 1440 and 2056; `check-hero-facts-global.mjs` (A11) asserts the selector is styled only in `app/globals.css` on the SAOC host.

**The /about tablet-band exception (NOS Design ruling (a), final).** At 769-1023 only, /about may show **two** rows of facts and a hero up to 520px. A14 at 769, 880, 960 and 1023 asserts /about at most two rows, no mid-word break, no overflow and hero at most 520, while the other seven routes stay 480 +-4. Dev measurements for /about: 480 (769), 488 (880), 504 (960), 516 (1023). The 480 +-4 lock at 768, 1024, 1280, 1440 and 2056 is unchanged.

### Event facts and the 404 page

- **Event facts, A12 (phase 5).** The `/events/[slug]` facts (start-aligned) broke words mid-word on beta ("Western Cape" became "Wester/n Cape", cells 145/228/86px in a 539px row, dd weight 300 at 31px, `overflow-wrap: anywhere`). The ruled fix: `overflow-wrap: normal`, cell `min-width: min-content`, dd balanced over at most 3 lines and breaking at spaces only, a wrapped row starting at the h1's left edge, plus the F1c levers (gap 24 at 768-1279, weight 400 below 32px). `check-event-facts.mjs` gates 1024, 1200, 1280, 1440 and 2056: one client rect per word in each dd and dt, no overflow, `dt.left = dd.left` +-1, a wrapped row starting at `h1.left` +-1. The route is the 19th national show event, else the first event. **Zero facts rendered fails**, never passes. Local fixtures have no events, so the proof is the deployed run. Measured on beta/main: 4 mid-word breaks plus overflow-wrap, min-width and text-wrap failures at every width. The fix is in `85cde1e9`.
- **404, A13.** The SAOC `/404` band ran straight into the dark footer (gap 0px at 390, 1440 and 2056 on main). `check-404-footer-gap.mjs` requires a parchment gap of at least 64px between the lowest content in main and the footer top at those three widths; `85cde1e9` implements it. The 404's font preload is covered under F1e.

## F1d: AVIF-first priority hero (SA-9)

Sharpness is non-negotiable (served pixels at least box x DPR); LCP is fixed with priority and bytes. Measured on beta before the change: `/` LCP 3262 ms, `/about` 2426 ms (limit 2500).

- **`components/ui/HeroPicture.tsx`** renders `<picture>` with an AVIF `<source>` first, a WebP `<source>`, and a WebP `<img>` fallback over the same width list. `next/image` cannot do this: the custom loader (`lib/image-loader.ts`) ignores `images.formats`, so it only emits WebP. `heroVariantSrcSet` and `heroVariantUrl` in the loader name the variants.
- **One priority image per page.** The priority hero is `loading="eager"` with `fetchPriority="high"` and exactly one `<link rel=preload as=image type="image/avif">` whose `imagesrcset` and `imagesizes` equal the AVIF `<source>`. Both must be in the server HTML (no JS). Home: slide 0 only; later slides are lazy, no preload.
- **Why `HeroPicture` is a client component.** `preload()` called in a Server Component also fires while Next serialises a route's not-found tree into the flight payload, which put the 404 hero's preload in every page's `<head>`. In a Client Component it runs only for the hero actually rendered into the HTML.
- **Why the header lockup is wrapped in `<picture className="contents">`.** The lockup drops `priority` but stays `loading="eager"` with default fetch priority (the hero must be the only prioritised image). React auto-preloads any non-lazy `<img>`, except one inside `<picture>`, so the wrapper stops a second preload. `display: contents` keeps layout unchanged.
- **Home slide 0 never fades.** An animated LCP element counts from the end of its animation, so `components/home/Hero.tsx` applies `transition-opacity` only once the carousel has left slide 0 (`fades`). No opacity animation or transition on the hero img, its wrappers or the h1, ever.
- **Encoding.** AVIF q55 and WebP q72 (the hero set, files named `-q88`) at identical widths. AVIF files are generated at build time by `scripts/generate-image-variants.mjs` into `public/images/_opt`, which is gitignored, so a fresh checkout has none until the build script runs. At 1200w, AVIF q55 is about 38 KB against 94 KB for WebP q88; the 1200w candidate must stay at or under 180 KB. NOS Design signs off one 390@3 and one 2056@2 crop by eye per encoder change (a human step, not assertable).

Gates: `check-hero-priority.mjs`, `check-hero-html.mjs`, `check-hero-bytes-sharpness.mjs`, `check-hero-no-fade.mjs`, and a grep that the generator and loader know AVIF.

## F1e: LCP critical path, glyphs and favicon

F1d alone does not reach 2.5 s on a local production build: `/about` LCP 4362 ms against FCP 2259 ms (a 2103 ms gap). The hero image's own phases total about 100 ms, so the gap is queuing: the simulated graph starts the image behind CSS and fonts. Measurements are in `goldens/f1e-measurements.md`, bounds in `goldens/lcp-bounds.json`. F1e is implemented on `feat/sdc-f1e-critical-path` (not merged, not deployed).

**Gate.** LCP at most 2500 ms on `/` and `/about`, Slow 4G mobile, **median of 3 runs on beta** (A11, phase 5). The local production LCP and the `/about` LCP-FCP gap are report-only (A18): they print and always exit 0, and the gap is never asserted. The 750w AVIF is at most 25,000 bytes (F1d measured 17,738). Never an LCP lever, guarded by A12 to A14: lowering hero quality or served px below box x DPR (Brad's P0), lazy-loading anything above the fold, reintroducing an h1 or hero fade.

### Levers, as ruled and as built

1. **Dedupe Crimson Pro.** `app/layout.tsx` has one declaration per font file with a weight range (`'300 600'` for Crimson Pro, `'400 700'` for Manrope, `'400 500'` for JetBrains Mono). The per-weight lists made next/font emit one `@font-face` per entry, so the browser requested the same file once per matching rule: on main every route requested Crimson normal, Crimson italic and Manrope twice and loaded 5 files. Gate A1 (static) and A2 (network).
2. **Subset and preload.** `scripts/subset-fonts.py` slims the shipped files in place (idempotent): the same Latin plus Latin-1 plus typographic punctuation code points, with variable axes clipped to the declared weight ranges and hinting and name records dropped. Exactly one font is preloaded, Crimson Pro normal, the face the h1 and hero use. `font-display: swap` with the metric-matched fallback stays, and CLS must stay under 0.02 across the swap (guard, 0.0104 worst on main).
3. **Critical CSS** (`experimental.inlineCss`): optional, approved only if the first viewport at 390, 1440 and 2056 is pixel-identical on the ten routes with no FOUC; any diff is a FAIL. A8 skip-passes while `inlineCss` is off.
4. **Favicon.** See below.

### The font preload and the build-time mapping

- `components/site-chrome/SaocFontPreload.tsx` renders one `<link rel="preload" as="font" type="font/woff2" crossOrigin="anonymous">` into the SAOC head. It is a rendered `<link>`, not `ReactDOM.preload()`, because React delivers font `preload()` calls as an HTTP `Link` header and keeps them out of the HTML head. For the same reason next/font's own preload is switched off on every face (`preload: false` in `app/layout.tsx`): it would go out as a header, and it would also preload the italic. `next dev` names the file differently, so the component renders nothing outside production and the face loads when first used.
- next/font names the emitted file with a content hash (`CrimsonPro_latin_normal-s.<hash>.woff2`). The name is committed in `components/site-chrome/crimson-preload.json` (it lives there, not under `goldens/`) and imported at build time, so the server does no filesystem work. The preload URL equals the `@font-face` src, so the file is fetched once.
- `scripts/crimson-font-preload.mjs` keeps the mapping honest. `--write` regenerates the JSON from `.next/static/media`; `--verify` fails unless it names the one `CrimsonPro_latin_normal` file the build emitted. `pnpm build` is `node scripts/generate-image-variants.mjs && next build && node scripts/crimson-font-preload.mjs --verify`, so a stale mapping fails the build instead of shipping a preload for a file that does not exist (which would also fetch the font twice). After any change that renames the file, run `node scripts/crimson-font-preload.mjs --write` after a build and commit the JSON.
- `check-preload-order.mjs` (A7): in the server HTML head the hero image preload comes before the first stylesheet, and exactly one font is preloaded; it must be the file the h1 resolves to, and the check **fails when the h1 face resolves to no `@font-face` file** (so it cannot pass without showing that). The deployed twin A20, with A19, must pass on beta before launch: the contract names the risk that the font preload could silently vanish on App Hosting's standalone output.

### The 404 page

The SAOC 404 (`app/not-found.tsx`) renders outside `SaocFrame`. It has no hero image, but it must still ship exactly one Crimson font preload for its h1, and `check-preload-order.mjs` now requests a nonexistent path alongside `/about` (and `/` when deployed). Its section and metadata live in `components/site-chrome/SaocNotFound.tsx`, a module of its own, so `app/(marketing)/not-found.tsx` and `app/(shared)/not-found.tsx` import them without importing `app/not-found.tsx`. `app/not-found.tsx` is host-neutral (main's ruling: reading the request host there made every route dynamic), so it always renders the SAOC 404; NOS unmatched paths reach the NOS 404 through the NOS catch-all. The 404's footer gap is F1c's A13. The 404's own hero preload leaking into other pages is the F1d trap that made `HeroPicture` a client component.

### Font cap and per-route evidence

A2 (`check-fonts-network.mjs`, cold cache, ten routes at 390 and 1440): no font file requested twice (detected by file, a sha256 of the response body, not by URL), **at most 4 distinct font files per route**, each at most 40 KB, and no loaded face unused by rendered text. The cap of 4 is NOS Design's for SAOC; the NOS routes' limit of 3 is NOS Site's TYPE-15 and is not asserted here.

The count is measured, not read from declared faces. Codex counted five on Home (Crimson normal, Crimson italic, Manrope, JetBrains Mono, Lora), which is the static union of declared faces. Measured at `9dccfbe5` (`DC_PROD`, `DC_DEBUG=1 node checks/check-fonts-network.mjs`, requests to network idle, distinct by hash):

- `/` at 390 and 1440: 4 files (CrimsonPro normal, CrimsonPro italic, Manrope, JetBrainsMono). **Lora is not fetched on Home.** `SaocLockup`'s Lora face is `preload: false` at weight 500 and loads only where a text wordmark renders; Home's footer lockup renders the raster emblem variant, so no Lora text exists and the browser never requests the file.
- Lora is fetched only on `/judging`, `/members` and `/contact` at both widths and on `/societies` at 1440. None of those exceeds 4, because none uses Crimson italic.
- Every other route loads 3 files (Crimson normal, Manrope, JetBrains Mono) or 4 with Lora. No route exceeds 4 and none fetches a file twice.

### Glyph coverage

- **A3** checks the shipped files' cmaps (`lib-woff2.mjs`, no font library): every served font has ê ë é è ô ï û, ‘ ’ “ ” – — … · • × and R, and nothing outside Latin, Latin-1 and the allowed symbol ranges. U+0149 (ŉ) was dropped by NOS Design (a ruling error: it is deprecated in Unicode and current Afrikaans writes 'n). Copy stays verbatim; A24 scans the Sanity fixtures for U+0149, prints hits and always exits 0, and hits go to NOS Design, never converted in content.
- **A4**, the computed-font walk (`check-font-fallback-walk.mjs`): on the ten routes at 390 and 1440, plus a society detail route (the first linked from `/societies`), every visible text node is set in a shipped face that contains every character in it. It also walks every visible input and textarea **placeholder** (resolved through `::placeholder`) and every element's quoted **`::before`/`::after` content**. The real case is `app/(marketing)/sponsors/page.tsx:133`, `before:content-['—']`: U+2014 resolves to Manrope, whose served cmap has U+2014 (verified with `lib-woff2.mjs` at `d5057e0f`), so it is not a finding.
- **U+2192 (→) and U+203B (※)** are in no shipped face and used to fall back to a system glyph. Neither is a text glyph any more; see the next two sections.

### The arrow

`components/ui/ArrowIcon.tsx` draws every right arrow as an inline SVG (`svg[data-glyph="arrow"]`, aria-hidden, `currentColor`). It is not a 1em box. Geometry (NOS Design ruling, `goldens/arrow-glyph.md`):

- **Label variant** (default): 1.25em wide (+-0.5px); the gap from the end of the label text to the SVG is 0.5em (`margin-inline-start`) plus the label's own letter-spacing, and there is no literal space in the markup. The shaft (`[data-part="shaft"]`) sits on the cap-height midline (baseline minus half of the canvas `measureText('T')` ascent, +-0.5px), never `vertical-align: middle`. The head (`[data-part="head"]`) is an open 45-degree chevron with 0.4em arms. Stroke is about 0.1em (the label's stem weight) with round caps and joins.
- **Corner variant** (`data-variant="corner"` on the card or link: the 21 society cards and the Home WOSA link): 1em wide, no margin, no gap assertion, top aligned to the title's first line. Cap midline is measured on that first line; `em` is the arrow's own font size.
- **Back arrow** (NOS Design ruling (b), final): `direction="back"` is the same label arrow mirrored with `scaleX(-1)` (computed matrix a < 0), same 1.25em box, head and stroke, but the 0.5em gap goes **after** the arrow (`margin-inline-end`), measured from the arrow's right edge to the first character of the following label. It is used by the "All societies" back link in `app/(marketing)/societies/[slug]/page.tsx`. A23 (`check-glyph-svg.mjs`) asserts it on a society detail route, which must carry at least one mirrored arrow. NOS archive arrows are out of F1e (NOS Site's follow-up).
- The baseline for the cap midline is the label's own text (the first client rect of the text node plus the canvas `fontBoundingBoxAscent` of its computed font), never an inserted probe: a probe becomes a flex item in `inline-flex` links and reads the link's centre.

**A29, the arrow-swap guard.** Swapping the glyph must move nothing. For every arrow link on every `ArrowIcon` caller that renders on the fixture build (the 21 society cards, Judging, the Home "Full calendar" and WOSA links, and one society page: 25 links, 75 rows at 1440, 390 and 2056), link height and label text-top equal the F1d build `7ee06e9a` (`goldens/arrow-links-f1d-7ee06e9a.json`, measured with `checks/measure-arrow-links.mjs`) with delta 0.00 +-0.01px, no title gains a line (counted from text nodes only; the SVG never counts), and the same links appear in the same order with the same labels. The back arrow has no F1d baseline (it was a text glyph outside it), so it is classified separately: expected on `/societies/[first]` only (at least one, label "All societies", never wraps) and unexpected anywhere else, with only its structure asserted. **Known gaps**, printed as KNOWN GAP on every run: `/events`, event pages and `EventCard`/`EventRow` (fixtures carry no events), the search overlay (no results on fixtures; it could not be opened at 390), NOS `/tickets` and its vendor and ticket routes (no arrow link, or `ERR_EMPTY_RESPONSE` on the fixture build), and `/sponsors` (no arrow link at F1d). The deployed run (A30) covers what fixtures cannot.

### The ※ status mark

U+203B in `components/show/_shared/StatusMarker.tsx` fell back to a system font. It is now an inline SVG (`svg[data-glyph="status-mark"]`, aria-hidden, `currentColor`), per `goldens/status-mark.md`. It is **not** 1em: its height is the label's cap height plus 4% overshoot top and bottom (mark top = T top minus overshoot, bottom = baseline plus overshoot, +-0.5px), stroke about the label's T stem (0.08 to 0.12em) with round caps, dots 1.5x the stroke (+-15%) as `<circle>`. `StatusMarker` renders on the SAOC host too (`PlaceholderMarker`, Home `NavCards` and `ShowBand`), so A23 checks Home at 1440 and 390 (each status badge leads with the status-mark SVG) and the source rule (when no shipped face has U+203B, the file holds the SVG and no text mark). Geometry is A27 (`check-status-mark-geometry.mjs`); the weight is ruled GO, so stroke and dot are structural checks only.

### The favicon

Derived by `scripts/generate-favicon.mjs`, which only crops and scales, never redraws: `app/favicon.ico` (16, 32 and 48 entries), `app/icon.png` (32), `app/icon1.png` (48) and `app/apple-icon.png` (180). The source is the copy recorded in `goldens/favicon-source.json` (path and sha256; `goldens/favicon-source/emblem-512.png`, a copy of the original `app/icon.png` committed in `d42f6cc0`), confirmed by NOS Design as the supplied emblem; swapping the emblem means editing that JSON and copying the file. Never ship from the untracked, in-progress Eulophia emblem in Brad's branding folder; if Brad finalises it, it comes in as its own change.

- Crop to the flower's bounds (the artwork's own bounds, white trimmed) before scaling, with a 1px margin, for the 16 (read from the `.ico`), the 32 and the 48. The 16 is accepted after the crop: no orchid survives at 16px, and the silhouette carries it.
- The 180 apple-touch is an opaque square on `#F4F3EC` with the flower at about 76% of the cell (asserted 72 to 80%), because iOS turns transparency black.
- Size gate (A9, corrected by NOS Design): icons fetched on page load total at most 10 KB (no `.ico` allowance), and apple-touch (not fetched on load) at most 16 KB. Main serves 277.6 KB. `check-favicon.mjs` also needs the `.ico` to hold the 16, 32 and 48 entries.
- `check-favicon-crop.mjs` (A21) asserts the crops and the opaque ground; A22 asserts the same on the 16/32/48/180 review renders in `goldens/favicon-renders`, produced by `checks/make-favicon-renders.mjs`; A25 is the deployed twin. NOS Design saw and approved the renders (GO, 2026-10-28).

### Accepted limitations of the F1e checks

Codex's A15 review found five weaknesses. Two are fixed in the checks: (a) the glyph walk now includes `::placeholder`, and (b) the network check dedupes by file hash rather than URL. Three are accepted, not closed, and A15's target tells the reviewer to judge the product code against the rulings and not to fail on them (`goldens/f1e-measurements.md`):

- **(c) Preload tag order versus network order.** `check-preload-order.mjs` proves the order of tags in the server HTML head, not the order of network requests, because a browser's request order is a scheduling outcome that headless fixtures cannot reproduce faithfully. The outcome gate is the phase 5 LCP check (A11, median of 3, at most 2.5 s on beta).
- **(d) Favicon likeness versus derivation.** `check-favicon.mjs`'s mean difference of at most 20/255 shows the icon resembles the supplied emblem, not that it was derived from it; pixel comparison cannot prove how a file was made. Provenance is held by `goldens/favicon-source.json` plus the build path that derives every icon from the source, and `check-favicon-crop.mjs` asserts the crop and opacity rules separately.
- **(e) `fetch()` plus CSS duplicate download.** The font walk and the network dedupe see only font-classified requests, so a woff2 fetched twice, by script and by CSS, would be invisible. No SAOC code fetches a woff2, proved by `grep -rnE "fetch\([^)]*woff" app components lib`, which must print nothing. Fonts load only through next/font `@font-face` rules, so the CSS request is the only request.

Also out of scope for A15, so recorded here: **font count is decided by A2's network measurement** (requests to network idle, by hash), not by reading the declared faces; Home measures 4, as above.

## Running the checks

Run from the project root; each script is `node .agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/<script>.mjs`. Full reference: `checks/README.md`.

Where the site comes from, in order:

1. `DC_BASE_URL` set: that origin is used. Beta credentials come from `BETA_BASIC_AUTH_USER` and `BETA_BASIC_AUTH_PASSWORD` (`node --env-file-if-exists=.env.local`), never printed.
2. `DC_PROD=1` and no `DC_BASE_URL`: `lib.mjs` runs `node scripts/generate-image-variants.mjs` and `next build` if `.next/BUILD_ID` is missing, then `next start` on a free port as `http://saoc.localhost:<port>`, and stops exactly that process.
3. Neither: `next dev`, fixture replay, beta wall off. Home and /events do not render under fixture replay, so Home-only checks skip rather than fake.

The production recipe:

```
SANITY_FIXTURE_MODE=replay SANITY_FIXTURE_DIR=.agent/memory/project/specs/nos-content-standard/fixtures/sanity \
BETA_PASSWORD_WALL_OFF=true BETA_BASIC_AUTH_USER= BETA_BASIC_AUTH_PASSWORD= \
NEXT_PUBLIC_SAOC_SITE_URL=http://localhost NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost \
  node scripts/generate-image-variants.mjs && node node_modules/next/dist/bin/next build   # or `pnpm build`: a bare next build leaves public/images/_opt empty and the hero returns 404; then the same env with: next start --port <port>
DC_BASE_URL=http://saoc.localhost:<port> node .agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/<script>.mjs
```

- The two site origins must differ; a `saoc.localhost` host is treated as a production build with Home enabled.
- **Never export the `NEXT_PUBLIC_*_SITE_URL` stubs in your shell** when running checks. They are set inline for the build only; exported, they leak into later runs and change which host the app believes it is.
- Lighthouse (`lib-lcp-lighthouse.mjs`, `pnpm dlx lighthouse@12.8.2`) uses the mobile preset: simulated Slow 4G, 4x CPU, 412px wide. Its **desktop preset is 1350px wide**, so any assertion made at 1440 must set the width explicitly. Local numbers run about 500 ms noisier and more pessimistic than beta (beta main: `/` 3262, `/about` 2426), so the local production gate is the harder one.
- **Playwright browser mismatch.** The worktree's Playwright 1.63 needs `chromium_headless_shell-1243`; only 1208 and 1217 are installed on this machine. A local browser run needs `npx playwright install`, which installs outside the project and is a decision for Brad, or a `PLAYWRIGHT_BROWSERS_PATH` workaround pointed under `.tmp/sandbox`. Until one of those is chosen, checks that drive a browser cannot run from that worktree.
- A cold start from a spec worktree (symlinked `node_modules`, no `.env`) never became ready within the 420 s readiness ceiling in `lib.mjs`; run cold from a real checkout. A true cold-cache run is still unproven.
- Post-deploy variants (phase 5) point `DC_BASE_URL` at `https://beta.saoc.co.za`. The `browser_deployed_check` contract kind cannot pass behind the beta Basic Auth wall (a known harness defect), so those assertions are declared non-required and the authenticated shell variants are the real proof.

### Adding a check

1. Put `check-<name>.mjs` in `checks/`, import `lib.mjs` for the origin, page opening and failure reporting, and print one `FAIL <name>: <route>@<width>: <what, want what>` line per problem, exiting non-zero.
2. Prove it **fails on main first** and record the output in `goldens/proof-on-main.md`. A check that cannot fail on main is a guard; say so in the contract description (F1c A2, F1d A2, F1e A5/A6 do).
3. Measure the thing itself: pixels for contrast, `getAnimations()` for transitions, the font file's cmap for glyphs. Wait for settled state before reading computed styles.
4. Add it to the feature's `contract.yaml` with a phase 5 twin if it must also run on beta, and keep the existing A-numbers stable (amendments append).

## Phase 5 checks still to run after deploy

These need a deployed beta (`DC_BASE_URL=https://beta.saoc.co.za`, credentials read inside the scripts and never printed) and have **not run**. The `browser_deployed_check` and `gws_inbox_check` manifests (every feature's triad assertions) are also phase 5 and non-required: the manifest is written by the post-deploy BrowserAgent and gws run, so it cannot exist at the phase 4 gate.

- **A11 (F1e), LCP.** Lighthouse mobile Slow 4G, median of 3 runs, LCP at most 2500 ms on `/` and `/about` (`check-lcp-gap.mjs`; the gap is printed, not asserted). Beta main at last read: `/` 3262 ms (fails), `/about` 2426 ms.
- **A30 (F1e), arrows.** `check-arrow-links-delta.mjs` against beta: arrow swap moved nothing, which also covers what fixtures cannot render (see the A29 known gaps).
- **A12 (F1c), events facts.** `check-event-facts.mjs` on the 19th national show event: no mid-word breaks, no overflow, aligned and wrapped rows. Local fixtures have no events, so this check only has meaning on beta.
- Also pending, from the other features: F1a A10 and A11 (status tokens and focus ring), F1b A8, A9 and A11 (nav one row, reach and spacing), F1c A6 (h2 roles, including Home and Events), F1d A7, A8, A11 and A12 (LCP, hero priority, server HTML, no fade), and F1e A18 to A20, A25, A26 and A28 (fonts, preload order and single preload, favicon crop, glyph SVG and status-mark geometry; A19 and A20 must pass before launch, see the preload section).
## Known gaps

- The NOS official-mono lockup ring does not match the unified ring.
- Footer email and WOSA links use the unified ring but are not probed by `check-focus-ring.mjs`; it probes the lockup, an Explore link, a legal link, and the media-kit link only when rendered (admin-only).
- The search overlay's result link cannot be probed on fixtures (live Sanity); only the deployed run covers it. The A29 arrow guard has its own list of unguarded callers (events, search overlay, NOS tickets and vendor routes, `/sponsors`).
- The Home carousel's lazy slides fetch alongside the LCP image.
- Home and `/events` cannot render under fixture replay, so they are proven only by the phase 5 deployed checks.
- Mobile hero anatomy below 768 is not equalised (content-driven; equalising would mean inventing copy or imagery).
- The hero-facts row at 1440 and up (gap 40, 26ch) and the 769-1023 interior are not asserted by A9; A14 covers rows, breaks, overflow and height there.
- F1a and F1b both edit `components/chrome/Header.tsx`; they were merged by hand on `feat/sdc-f1b-nav` (F1b width classes plus F1a ring). The error-summary wrapper in `VendorApplyForm` still differs between the F1a and F1e branches until they are merged.
- The accepted F1e check limits (c), (d) and (e) above are limits of the checks, not findings against the product.
