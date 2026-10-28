# SAOC design consistency (mission backlog-wave-2026-10-28)

Five features that bring the SAOC host (not the NOS host) to one set of rules: status tokens and one focus ring (F1a), a desktop nav that fits at 1280 (F1b), one h2 role and one inner-hero height (F1c), an AVIF-first priority hero (F1d), and a shorter mobile critical path (F1e). The rulings are NOS Design's, recorded in `comms.md` ("rulings on MERGED.md", "SA-6: /about hero at 1024 and 1280", "LCP critical-path levers", "F1e: favicon source and glyphs", and the SA-1 acceptance). Rules: [`docs/rules/no-invention.md`](rules/no-invention.md).

Status at writing: F1a, F1b and F1d are implemented on their feature branches. F1c is **in progress** (the h2 role has landed; the hero-facts levers and dd weight band have not). F1e is **in progress** (contract, goldens and checks exist; no implementation yet). Nothing here is deployed; the phase 5 checks are pending.

Spec, contracts, goldens and checks: `.agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/`. Proof that the checks fail on `origin/main` (48d74378): `goldens/proof-on-main.md`.

## F1a: status tokens, one focus ring, breadcrumb targets, newsletter field

**Status tokens.** `app/globals.css` `:root` defines `--status-error #8f2834`, `--status-success #2f5d3a`, `--status-warning #7a5a12`. Before this, `--status-error` was referenced by `components/vendors/*` but defined only in `app/(nos)/national-show/nos-theme.css`, so on the SAOC base it resolved to nothing. Contrast on parchment is 7.49, 6.87 and 5.72. Used only as text plus icon, never colour alone (success sits close to the `--primary` sage, which is why the icon is binding). Error summaries use the same token as a 2px border (`border-2 border-[var(--status-error)]`), no tint, with an `aria-hidden` `CircleAlert` icon beside the text (`VendorApplyForm`, `VendorRegistrationCodeEntryForm`). The vendor forms render only on the NOS host, so the SAOC-host guarantee is the token itself plus the static check `check-error-summary-static.mjs`.

**One focus ring.** 2px solid, offset 3px. Ivory on dark grounds (hero, footer), `--primary` on parchment (header, breadcrumb). The reference is the Home hero CTA ring in `components/home/Hero.tsx`. It replaces three older treatments: the 2px underline on footer and CTA links (NAV-1, [`nav-focus-underline.md`](nav-focus-underline.md)), `ring-2` on Menu and the lockup, and `outline-none` on Join. The underline stays gone from those controls; the NAV-1 route-focus and `aria-current` work is untouched.

The outline colour is also set unconditionally (`outline-ivory` or `outline-primary` with no `focus-visible:` prefix on the hero CTAs, Join and Menu). Those controls carry `transition-colors`, which animates `outline-color` from `currentColor` on focus. With the colour set only under `focus-visible:`, the ring starts as the text colour and fades to the right one, so a check (or an eye) reading it early sees the wrong colour. An earlier "hero CTA ring 1.42:1" reading in the proof was exactly that artefact. `check-focus-ring.mjs` now waits for `document.getAnimations()` to finish plus a 300 ms floor before reading computed styles.

The check measures contrast from pixels, not from computed backgrounds: it hides the outline, screenshots a band 2 to 6px outside the element box (the ring paints 3 to 5px out) and takes the worst case of the settled ring colour against those pixels, so photographs and scrims count. A target whose ring box (element plus 5px) is clipped by the viewport on any side fails rather than skips.

**Breadcrumb targets.** `components/chrome/Breadcrumb.tsx` links are `inline-flex min-h-6 min-w-6 items-center`, so each is at least 24x24 (Home was 37x19). The breadcrumb link ring is the same ring.

**Newsletter field.** On main the footer field measured 3.00:1 (placeholder `ivory/40`) and 1.85:1 (border `ivory/20`) against the `#22281f` ground. Now the placeholder is `ivory/75` (needs 4.5:1) and the border is `--accent-soft` (needs 3:1). No new colour; `check-no-new-colours.mjs` guards that no hex literal is added outside the three status values.

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

Merge note: F1a and F1b both edit the Join CTA and Menu class strings in `Header.tsx`. On F1b alone those controls still use the old underline and `ring-2`; the merged result must carry F1b's width classes and F1a's ring.

## F1c: h2 role, Title role, hero heights (in progress)

**Landed (commit 553fe5e9).**

- **H2 role:** serif (Crimson Pro), weight 300, `--h2-role: clamp(32px, 29px + 0.762vw, 44px)` (32 at 390, 39.97 at 1440, 44 at 2056), line-height 1.15. Defined in `app/globals.css` and applied through `.h2` and `.doc-h2`, scoped `:not(.nos-theme *)` so the NOS host keeps its own scale. Section h2s that carried their own clamp (`MissionBlock`, `ShowBand`, `NavCards`, `EventsStrip`, `YearbookStrip`, `CTASection`, `SponsorEnquirySection`, vendor intro and empty state) now use `text-[length:var(--h2-role)] leading-[1.15]`.
- **Title role** for card-type h2s: serif 400 at 20 to 22px (e.g. `MonthGroup` month heads went from 24px to 22px). The hero h1 is untouched, and Brad's display-weight 300 ruling stays.
- Gate: `check-h2-roles.mjs`, every main h2 is the H2 or Title role at 390, 1440 and 2056. It failed 150 times on main locally (186 on beta, which includes Home and Events).

**Hero heights.** Inner `PageHero` is locked at 480 +-4 at 768, 1440 and 2056 across the eight non-exempt routes (/about /judging /sponsors /members /memorandum-of-incorporation /privacy /terms /refunds). Exempt: Home, Events list, Societies grid, Contact, 404, and /media-kit (a gated tool page with a typographic header). On main that lock already passes; it is a lock, not a red check. Below 768 height is content-driven and not gated; instead every photo band uses one aspect ratio (`aspect-[2/1]`) and every copy block one padding (`py-10`, `md:py-16`), asserted by `check-hero-mobile-anatomy.mjs`.

**The /about defect (not yet fixed).** At 1024 and 1280 /about measures 496 and 545 against 480 elsewhere. Its `dl[data-hero-facts]` needs about 600px in a copy column of about 570px (1280) or 450px (1024), so the row wraps. NOS Design ruled one facts row, no copy change, no facts moved out of the hero, with these levers applied in order at 768 to 1439, globally in `.hero-facts`, never per route:

1. Column gap 40 to 24.
2. `dt` max-width 26ch to 18ch, `text-wrap: balance`, at most 3 lines.
3. `dd` floor 24px at 1024, with the weight band: serif 300 at 32px and up, 400 at 24 to 31.99px. Today `dd` is 300 at every size on every SAOC hero, which breaks Brad's weight rule below 32px; this is fixed in the same change.
4. `dd` `white-space: nowrap`.

Not allowed: widening the 48% copy column or shrinking the scrim (clear to 44%, full by 52%, alpha 0.8). Gates: `check-hero-facts-row.mjs` (one row, dd tops within 1px, no overflow, levers, column and scrim unchanged), `check-hero-dd-weight.mjs`, `check-hero-facts-global.mjs` (the selector is styled only in `app/globals.css` on the SAOC host), and `check-hero-heights-report.mjs`, which locks 1024 and 1280 for all eight routes (CASE A). Fallback CASE B applies only if /about@1024 alone still wraps: 1280 is locked for all eight, 1024 for the other seven, and /about@1024 is reported with a screenshot (`DC_SHOT_DIR`) for NOS Design to judge by eye.

## F1d: AVIF-first priority hero (SA-9)

Sharpness is non-negotiable (served pixels at least box x DPR); LCP is fixed with priority and bytes. Measured on beta before the change: `/` LCP 3262 ms, `/about` 2426 ms (limit 2500).

- **`components/ui/HeroPicture.tsx`** renders `<picture>` with an AVIF `<source>` first, a WebP `<source>`, and a WebP `<img>` fallback over the same width list. `next/image` cannot do this: the custom loader (`lib/image-loader.ts`) ignores `images.formats`, so it only emits WebP. `heroVariantSrcSet` and `heroVariantUrl` in the loader name the variants.
- **One priority image per page.** The priority hero is `loading="eager"` with `fetchPriority="high"` and exactly one `<link rel=preload as=image type="image/avif">` whose `imagesrcset` and `imagesizes` equal the AVIF `<source>`. Both must be in the server HTML (no JS). Home: slide 0 only; later slides are lazy, no preload.
- **Why `HeroPicture` is a client component.** `preload()` called in a Server Component also fires while Next serialises a route's not-found tree into the flight payload, which put the 404 hero's preload in every page's `<head>`. In a Client Component it runs only for the hero actually rendered into the HTML.
- **Why the header lockup is wrapped in `<picture className="contents">`.** The lockup drops `priority` but stays `loading="eager"` with default fetch priority (the hero must be the only prioritised image). React auto-preloads any non-lazy `<img>`, except one inside `<picture>`, so the wrapper stops a second preload. `display: contents` keeps layout unchanged.
- **Home slide 0 never fades.** An animated LCP element counts from the end of its animation, so `components/home/Hero.tsx` applies `transition-opacity` only once the carousel has left slide 0 (`fades`). No opacity animation or transition on the hero img, its wrappers or the h1, ever.
- **Encoding.** AVIF q55 and WebP q88 (the existing hero set) at identical widths. AVIF files are generated at build time by `scripts/generate-image-variants.mjs` into `public/images/_opt`, which is gitignored, so a fresh checkout has none until the build script runs. At 1200w, AVIF q55 is about 38 KB against 94 KB for WebP q88; the 1200w candidate must stay at or under 180 KB. NOS Design signs off one 390@3 and one 2056@2 crop by eye per encoder change (a human step, not assertable).

Gates: `check-hero-priority.mjs`, `check-hero-html.mjs`, `check-hero-bytes-sharpness.mjs`, `check-hero-no-fade.mjs`, and a grep that the generator and loader know AVIF.

## F1e: LCP critical path (in progress)

F1d alone does not reach 2.5 s on a local production build: `/about` LCP 4362 ms against FCP 2259 ms (a 2103 ms gap). The hero image's own phases total about 100 ms, so the gap is queuing: the simulated graph starts the image behind CSS and fonts. No F1e code exists yet; the contract, measurements (`goldens/f1e-measurements.md`), bounds (`goldens/lcp-bounds.json`) and checks do.

**Bounds.** LCP at most 2500 ms on `/` and `/about` (Slow 4G, mobile); `/about` LCP minus FCP at most 1000 ms; the 750w AVIF at most 25,000 bytes (F1d measured 17,738). The bounds may be tightened later, never loosened.

**Approved levers (one scope), in order:**

1. **Dedupe Crimson Pro.** One declaration and one request per font file per route; ship only weights and styles that render. On main, `app/layout.tsx` declares each Crimson Pro file 4 times, Manrope 4, JetBrains Mono 2, and every route requests three files twice and loads 5. Gate: at most 3 font files on the critical path, none fetched twice.
2. **Subset and preload.** Latin plus Latin-1 Supplement, keeping ê ë é è ô ï û and ‘ ’ “ ” – — … · • × and R. Preload exactly one font, the face the h1 and hero use. `font-display: swap` with the metric-matched fallback. Gate: CLS under 0.02 across the swap (0.0104 worst on main, a guard). No glyph falls back to a system face on the ten routes, proved by a cmap walk (`lib-woff2.mjs`), not by eye.
3. **Critical CSS** (`experimental.inlineCss`): optional, approved only if the first viewport at 390, 1440 and 2056 is pixel-identical on the ten routes with no FOUC. Any diff is a FAIL. The check skips-passes while `inlineCss` is off.
4. **Favicon.** Icons fetched on page load total at most 10 KB (15 KB with an `.ico`); apple-touch (not fetched on page load) at most 16 KB. Source is `app/icon.png` (d42f6cc0, sha in `goldens/favicon-source.json`), never the untracked, in-progress Eulophia emblem in Brad's branding folder. Crop to the flower's bounds before scaling, for 16 and 32 only (a crop of the supplied file, not a redraw). 180 apple-touch is an opaque square on `#F4F3EC`, flower at about 76% of the cell. NOS Design sees the 16/32/180 renders before merge. Main serves 277.6 KB.

Also: the hero preload `<link>` stays in `<head>` before the stylesheets (already true on main), and exactly one font preload.

**Glyph rulings.** U+0149 (ŉ) is dropped from the requirement (deprecated in Unicode, current Afrikaans spelling is 'n; it is not in source). Copy stays verbatim: if a Sanity document contains it, report it, do not convert it. U+2192 (→) goes into the subset where the source font has it; where a face lacks it, the arrow becomes the site's existing SVG arrow (`currentColor`, 1em), never a system glyph. U+203B (※, the aria-hidden mark in `components/show/_shared/StatusMarker.tsx`) becomes an inline SVG of the same mark if Manrope lacks it, with before and after crops at 1440 and 390. The checks' ŉ requirement predates this ruling; reconcile `check-font-glyphs.mjs` before the F1e gate.

**Never** (guards A12 to A14, pass on F1d): lowering hero quality or served px below box x DPR (Brad's P0), lazy-loading anything above the fold, reintroducing an h1 or hero fade.

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

## Known gaps

- The NOS official-mono lockup ring does not match the unified ring.
- The vendor error-summary wrapper's focus ring (`focus-visible:ring-2 ring-primary` on the summary `div`) is not the unified ring.
- Footer email and WOSA links were changed to the unified ring but are not probed by `check-focus-ring.mjs` (it probes the lockup, an Explore link and a legal link; the media-kit link only when rendered, as it is admin-only).
- The Home carousel's lazy slides fetch alongside the LCP image.
- Home and /events cannot render under fixture replay, so they are proven only by the phase 5 deployed checks.
- Mobile hero anatomy below 768 is not equalised (content-driven; equalising would mean inventing copy or imagery), and /media-kit has no `PageHero`.
- F1c (facts-row levers, dd weight band) and F1e (all four levers) are unimplemented; the phase 5 checks (F1a A10/A11, F1b A8/A9/A11, F1c A6, F1d A7/A8/A11/A12, F1e A18 to A20) have not been run.
- The favicon 16px render scores 11.5 on the derivation test (bound 20): acceptable per NOS Design, since no orchid survives at 16px and the silhouette carries it.
