# nos-type-tokens inventory (phase 1, read-only)

Base: origin/main 48d74378 (does NOT include PR #133, open and mergeable). Production build on Sanity fixture replay (0 misses, 0 Sanity API requests), headless Chromium, NOS host, 390/768/1280/1440, 26 paths: the 22 required sweep routes plus a 404, /tickets/weekend-pass (renders only an h1, a ticketType fixture gap), /archive, /newsletter/unsubscribe. Token-gated vendor routes and /media-kit are not swept. Raw per-text-node data: `inventory-measure.json`. Every CSS rule that sets a serif family: `inventory-fraunces-css-rules.txt`.

The target rule is NOS Design's one-line summary only (300 at >=32, 400 at 20-31, 500 below 20). The ruling text has not landed, so nothing here fills a gap in it. Gap seen, not resolved: sizes between 31 and 32 (one live case, `h2.nos-hm-h2` 31.49px at 768).

## 1. Fraunces (NR-1)
Measured: 3,216 Fraunces text nodes across the sweep. 1,159 break the rule (390: 357, 768: 268, 1280: 267, 1440: 267).
By band: below 20px not at 500: 644. 20-31px not at 400 (all at 300): 487. At 32px or more not at 300: 28.
Computed groups (selector class signature): 52, of which 20 comply everywhere and 32 contain a violating size/weight pair.
Source: 63 CSS rules set Fraunces, 59 in `app/(nos)/national-show/nos-structure.css` and 4 in `nos-theme.css` (lines 344, 568, 633, 831); the chrome (`components/nos-chrome/nos-chrome.css`) reaches it through `--nc-serif`. Plus 9 Tailwind `font-serif` utility sites in NOS routes and about 35 in shared components that NOS routes also render (vendors, tickets, media-kit). The weight mechanism is layered: `.nos-theme :is(h1..h6)` sets 400 (`nos-theme.css:344`), `.nos-theme .font-serif:not(h)` sets 400 (`:403`), `.nos-light.font-serif` and `.nos-figure.font-serif` set 300 (`:408`, `:412`), and each class rule in nos-structure.css restates its own.

Worst offenders (routes, size, weight):
- Below 20 at 400 or 300, want 500: `nk-admit` 16px (6 routes), `nk-theme` 17 (4), `nos-pr-lead` 19, `nos-ct-label` 18, `nos-index-arrow` 18, `nos-pg-session .n` 18-22, `nos-faq-question` 19 (390 only), `nos-faq-qn` 16-17 at 300, `nos-num` 19.84 at 300, `em` 16.
- 20-31 at 300, want 400: hero facts `dd` 20-24 (14 routes, the 23-26 September line), `.doc-standfirst` 20-26 (9 routes, nos-structure.css:2753), `nos-hero-lede` 22-25.6 (nos-theme.css:568, :633), `nos-close-line`, `nos-hm-lead`, `nos-hm-card-dates`, `nos-we-dates`, `nk-cur` 17.9-25.8 (6 routes), `nos-num` 24.18.
- 32px or more not at 300: `h2` "Tickets" 32-39px at 400 (2 routes), `h2.nos-hm-h2` 39.7px at 400 (1280/1440), `h2.sr-only` 32-48px at 400 (What to Expect, visually hidden).
- `h3.font-serif.text-[20px].font-medium` (`app/(nos)/national-show/tickets/page.tsx:197`) computes 400, not 500: `nos-theme.css:403` beats the Tailwind class, so `font-medium` utilities are dead under `.nos-theme`.

## 2. Body 450 (NR-6)
Karla body text: 1,916 long-text nodes (>=40 chars) are all weight 400 (8 at 700). Body sizes 14-17px; most common is 16px (p, li). There is no body-weight token: weight is the inherited 400.
Karla file `app/fonts/karla/Karla-latin-normal.woff2` is a VARIABLE font (wght axis). Measured widths of one sentence when declared as a range: 400: 814.7, 450: 822.9, 500: 831.1, 600: 842.6, 700: 853.2. The axis floor is 400 (300 renders as 400).
It is declared as four DISCRETE faces (400, 500, 600, 700) from the one file in both `components/nos/NosThemeScope.tsx:31-36` and `components/nos-chrome/fonts.ts:19-24`. Measured consequence: `font-weight: 450` renders the 500 instance (831.08px, identical to 500) because the browser snaps to the nearest declared face. A true 450 needs the declaration changed to a range (`weight: '400 700'`) in both files. That is a font-loading change, not only a token.

## 3. One h1/h2 and 3 labels (NR-7, NR-8)
h1: exactly one h1 on all 26 paths. There are 5 h1 treatments: `nos-hero-title` Fraunces 300 (69.8px at 1280, 48 at 390; 17 routes), `.is-long` 58.9px (6 routes), the tickets h1 56.3px, one at 62.7px, and the system-ui error-boundary h1 (24px/500, "This page couldn't load", reached on a fixture miss).
h2 at 1280: 11 distinct treatments: `doc-h2` 300/39 (8 routes), bare `h2` 300/39 and 400/39, bare `h2` 300/51.2, `nos-hm-h2` 400/39.7, `nos-ex-q` 400/25, `nos-sp-card-title` 400/25, `nos-ct-label` 400/18, `sr-only` 400/48, `nos-num` span 300/24.2, and `h2.nos-index-eyebrow` Karla 600/12px (14 routes; a label marked up as an h2). h2 count per route runs 0-19 (terms 19, faq 12, privacy 11, plan-your-visit 9).
Labels at 1280 (uppercase or tracked), by treatment:
1. Chrome: Karla 700 uppercase 13px, tracking 1.56px (`nh-cta`, `nh-burger-label`); footer `nf-head` 12px/1.68; subscribe button 13px/1.3.
2. Show pages: Karla 700 uppercase 14px/1.68 (`nk-btn` CTAs); Karla 600 uppercase 12px/1.68 (`nos-hero-eyebrow`, `nos-index-eyebrow`, the 404 chip, "Days", "Opens in").
3. Sentence-case: Karla 600-700 13-14px, tracking 0.28-0.78 (`nk-numlab`, `nk-when`, `nk-visit-label`, `dt`); `nos-form-label` Karla 500/14, legends 700/14; `nf-reg-item` 400/13 tracked 1.04.
Strays outside Karla: footer tagline JetBrains Mono 500 8.36px uppercase (`components/chrome/SaocLockup.tsx:53`, S-3); preview banner Manrope 700 15px uppercase tracked 1.2px ("Testing only, not live", 3 routes); a vendor form `label.font-mono` Karla 700 12px with a `tracking-[0.16em]` utility.
So there are roughly 12 distinct size/weight/tracking triples in use, grouped by role into the three families above.

## 4. TYPE-11
Footer newsletter topic checkbox labels compute `Manrope` 16px/400 (200 nodes over 25 routes). Cause: `components/newsletter/NewsletterSignup.tsx:141` puts the Tailwind `font-sans` utility on the label. The NOS footer sits outside `.nos-theme`, so `--font-sans` resolves to the SAOC value in `app/globals.css:141` (`var(--sans)`, Manrope), not `nos-theme.css:128` (Karla). The chrome's own `.nf-*` rules use `--nc-sans`, so they are Karla. The same footer also renders the SAOC lockup in Lora (15px/500) and the mono tagline.

## 5. S-2 numerals
`span.nos-num` (`nos-structure.css:821`, inside `h2.doc-h2.nos-num-h2` on /faq and /plan-your-visit): Fraunces 300, 19.84px at 390 up to 24.18px at 1280/1440, colour `#7F7D33` (`--olive-deep`) on `#FBFAF0`: 4.10:1. Fails 1.4.3 (4.5:1) at 390, where 19.84px is not large text. At 1280 (24.18px, at or above 24) it clears the 3:1 large-text floor. It does NOT fall out of NR-1: NR-1 changes its weight (300 to 400 or 500), not its colour, and weight does not cross the large-text line below 24px. It needs a colour change; the NR-9 value `#6A6829` is the same olive family but is unverified here (taken from the summary). `nos-faq-qn` (FAQ row numbers, 16-17px/300) is `--muted` on white at 5.43:1, passes, and is a plain NR-1 weight violation.

## Base for NR-1
#133 (feat/nos-hub-tablet-serif) edits the same rules: `nos-theme.css` 355-370 (headings 300 at >=32 plus the `nos-opsz-fluid` 889px rule), `:403`, and the section h2s in nos-structure.css. Recommendation: base NR-1 on #133 (branch from its head, or from main once it merges). Building on main guarantees a conflict in those lines and would reverse its tested changes.
