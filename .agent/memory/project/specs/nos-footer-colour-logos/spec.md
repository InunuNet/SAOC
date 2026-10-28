# nos-footer-colour-logos: COUNCIL-1 C2 + TYPE-11

Source: NOS Design ruling "[SAOC NOS Design -> SAOC NOS Site] 2026-10-28, COUNCIL-1", root `comms.md` ~line 4940 (read: C2, C4 NOS part). Rules: `docs/rules/no-invention.md`; visual sources are `public/downloads/media-kit/` only. Read from `origin/main` e2088ede. Built on main AFTER `feat/nos-type-tokens` merges.

## The ruling (verbatim, trimmed to the NOS part)

- C2: "NOS lockup -> `NOS-2027-logo-full-colour-reversed-vertical.png` (media-kit/nos, 3272x2876). That is the same size as today's reversed-gold file, so it drops into LOCKUP_SRC with the LG-1 ladder." "**Not** `nos-2027-logo-full-colour-vertical.png`: its dark wordmark disappears on royal (rendered)."
- C2: "SAOC credit -> the C1 file at the credit's current box, replacing OfficialMonoLockup (grey emblem plus Lora and Mono text)." C1 file: `public/downloads/media-kit/saoc/lockup/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark.png` (1915x1531, transparent); "Box: the current lockup width +/-4. Serve from a resize-only ladder of that file, never recoloured or cropped, with served px >= box x DPR at 3x. Alt is the current accessible label."
- C4: NOS is Fraunces and Karla only. "C2 removes Lora and Mono. TYPE-11 moves up now: the footer Manrope nodes take Karla."
- Gate: by eye at 1440 and 390 (NOS Design, on beta); served px >= box x DPR; "the first family of every rendered text node is one of the site's pair".

## Measured: where the 2 Manrope nodes come from

`components/newsletter/NewsletterSignup.tsx:141` puts Tailwind `font-sans` on each topic checkbox `<label>` (`NEWSLETTER_TOPICS = ['saoc','nos']`, `lib/newsletter.ts:17`: two labels, so two text nodes; `:160` is the per-topic error `<p>`, same class, rendered only on error). `font-sans` reads `--font-sans`, which `app/globals.css:50` defines as Manrope first. The NOS footer sits outside `.nos-theme`, so nothing overrides it. NewsletterSignup is SAOC-owned and is not edited.

NOS-scoped fix, no SAOC-lane edit needed: redefine the variable inside the NOS footer root. `nos-chrome.css` `.nf { --font-sans: var(--nc-sans); }` (and `--font-serif`).

## Sequencing: what `feat/nos-type-tokens` already covers (diffed against origin/main, ead8e102)

Its `components/nos-chrome/nos-chrome.css` hunk is exactly `.nf { --font-sans: var(--nc-sans); --font-serif: var(--nc-serif); ... }` (its spec section 8, its contract A16 `footer-font-var`, with `NewsletterSignup.tsx` asserted untouched). That is the whole TYPE-11 fix. So once type-tokens is on main, **TYPE-11 needs no code in this feature**: only verification. This feature adds (a) the `prereq` pin (A5) so the contract fails loudly if built before type-tokens, and (b) the family census over `/`, `/faq`, `/tickets` at 390 and 1440 (A8) that proves the checkbox labels, and everything else, resolve to Fraunces or Karla. Do NOT add the `.nf` variable here as well: both edit the same line of `nos-chrome.css` and would conflict. If type-tokens slips, the fallback is that one declaration, written identically, and A5 passes either way.

The same branch also changes `fonts.ts` (shared exports, one Karla 400-700 file), `NosThemeScope.tsx` and `.nf-head/.nf-form button` sizes; none touch the lockups, so there is no overlap with this feature's lines (NosFooter.tsx is not in its diff).

After this feature: Lora and JetBrains Mono leave the NOS footer because `OfficialMonoLockup` (the only Lora/Mono user there) is no longer rendered. The NOS footer then has no live-text logotype at all.

## The ladder: reused, with one correction to the ruling's file path

Mechanism (do not invent another): `getImageProps({ src, width: BOX, height, sizes: '<BOX>px' })` gives a width srcset over the whole ladder; `lib/image-loader.ts` maps a `/images/*.png|jpg` src to a pre-built WebP at `/images/_opt/<name>.png-<w>.webp` (widths 16..2048, `lib/image-widths.json`); `scripts/generate-image-variants.mjs` resizes with sharp, `withoutEnlargement`, no crop, no recolour. See `nos-logo-3x/spec.md` (LG-1).

**Correction:** the loader only maps srcs that start with `/images/`; anything else (including `/downloads/media-kit/...`) is returned unchanged, i.e. the browser would fetch the 5MB master with no srcset. So `LOCKUP_SRC` cannot literally be the media-kit path. Precedent (`docs/nos-critique-r17.md:42`): `public/images/` holds a byte-identical copy of the media-kit master. Therefore:

1. Add `public/images/NOS-2027-logo-full-colour-reversed-vertical.png` = `cmp`-identical copy of the media-kit file. 3272x2876 RGBA.
2. Add `public/images/saoc/lockup/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark.png` = identical copy of the C1 file, in the `saoc/lockup/` subfolder to match SAOC's C1 (same filename). 1915x1531 RGBA. Nested `/images/` paths are laddered: `lib/image-loader.ts` keeps the relative path in the variant name (`/images/_opt/saoc/lockup/<file>.png-<w>.webp`) and `generate-image-variants.mjs` walks `public/images` recursively (`public/images/nos/` is the existing precedent).
3. `git rm public/images/NOS-2027-logo-reversed-gold-vertical.png` (its only consumer is NosFooter; the media-kit original stays). Update the one sentence at `docs/nos-critique-r17.md:42` only if it reads as current state (history may stay).

At 3x the variants cover it: NOS box 248 needs 744, the 750 variant serves; credit box 206 needs 618, the 640 variant serves (source 1915 is never upscaled).

## Exact changes for @dev

`components/nos-chrome/NosFooter.tsx` (reference diff: `goldens/prototype-footer.diff`, applied and reverted by the architect; dev may restyle but the pins in A1-A4 must hold):
- `LOCKUP_SRC = '/images/NOS-2027-logo-full-colour-reversed-vertical.png'`; `LOCKUP_WIDTH/HEIGHT` stay 3272/2876; `LOCKUP_BOX` stays 248. Update the header comment ("supplied gold vertical lockup" becomes the full-colour reversed lockup).
- Remove `import { SaocLockup }` and the `<SaocLockup variant="official-mono" .../>` element. In its place inside `.nf-saoc-credit`: `<a className="nf-credit-lockup" href={saocUrl('/')} data-testid="nf-saoc-lockup"><picture><img {...credit} alt={CREDIT_ALT} width={1915} height={1531} loading="lazy" decoding="async" /></picture></a>`, with `credit` from a second `getImageProps` (`src` the credit file, `width: 206`, `height: round(206*1531/1915)` = 165, `sizes: '206px'`). The plain same-tab anchor, the test id and the `nf-credit-reg` REG/NPO block below it are unchanged.
- `CREDIT_ALT = 'South African Orchid Council Making a difference since 1968'`: the current accessible name (the old link had no aria-label; its name was its visible text, wordmark then tagline). Before editing, dev reads the live name on main (`page.getByTestId('nf-saoc-lockup').evaluate` via Playwright accessibility snapshot) and, if it differs from this string, uses the live one and updates `goldens/values.json` credit.alt.

`components/nos-chrome/nos-chrome.css`: add `.nf-credit-lockup { display: block; width: 206px; max-width: 100%; line-height: 0; border-radius: 4px; }` and `.nf-credit-lockup img { display: block; width: 100%; max-width: none; height: auto; }` next to `.nf-saoc-credit`. Nothing else: `.nf-lockup` margins stay (the new NOS file has the identical transparent padding: measured alpha>8 bbox L229 R250 T224 B256 for both files), the existing `.nf-saoc-credit a:focus-visible` ring (2px, offset 3px) already covers the new anchor, and no hex, font or colour is introduced. The art is trimmed to its ink (bbox 0/0/0/0), so img box = ink box.

`e2e/nav-followup-a11y.spec.ts` and `scripts/checks/footer-render-check.mjs` select `[data-testid="nf-saoc-lockup"]` and `.nf-lockup img`; both still match. Only touch them if a run proves otherwise.

Do NOT edit (except the one-word `export` above): `components/chrome/**` (including the now-unreferenced `official-mono` branch and `public/images/saoc-lockup-vertical-emblem.png` it loads: a SAOC-lane follow-up to retire, to be posted to SAOC), `components/newsletter/**`, `app/layout.tsx`, `components/sponsors/**`, `app/(nos)/national-show/sponsors/page.tsx`.

## NOS Design rulings folded in (2026-10-28, root comms.md)

1. Credit box: match the old height. 229 wide, about 183 tall (+/-4), `max-width: 100%` and `height: auto` so nothing overflows at 768-1023 or 390. `getImageProps` width 229, height `round(229*1531/1915)` = 183, `sizes: '229px'`; `.nf-credit-lockup { width: 229px; max-width: 100%; }`. At 3x it needs 687 px, the 750 variant serves. `gate-logos.mjs` asserts the 229x183 box at 1440 and 390, and no sideways scroll, no footer overflow and credit inside the viewport at 390, 800 and 1023.
2. Alt: `import { ACCESSIBLE_LABEL } from '@/components/chrome/SaocLockup'` and use `alt: ACCESSIBLE_LABEL` (value "South African Orchid Council \u2014 Making a difference since 1968"). Never retyped. `ACCESSIBLE_LABEL` is a non-exported `const` today (`SaocLockup.tsx:54`), so the ruling needs ONE edit in the SAOC lane: add `export` to that line. A7 permits exactly that one-line change and nothing else in `components/chrome/`. `check-static.mjs alt` asserts the export, the import, the identifier use, no retyped literal, and that `values.json` equals the source string. The credit link has no aria-label; its name comes from the alt.

## Gates

By eye at 1440 and 390 stays NOS Design's on beta. The architect's gate screenshots land in `.tmp/sandbox/nos-footer-colour-logos-gate/`. The two live gates need `pnpm build` and a `next start`: `checks/gate-logos.mjs` (served px >= box x DPR for both marks at 1440 and 390, DPR 1/2/3; ladder variant of the pinned file; box 248 and 206 +/-4; alt and link name) and `checks/census-fonts.mjs` (first family in {fraunces, karla} for every rendered text node, `/`, `/faq`, `/tickets`, 390 and 1440, NOS host). Both run Sanity in replay (`SANITY_FIXTURE_MODE=replay`, `SANITY_FIXTURE_DIR` the tracked `nos-content-standard/fixtures/sanity`, `SANITY_NET_ALLOW` unset), start `next start` by pid and kill that exact pid.

## What was and was not run by the architect

Run: `check-static.mjs` modes (all FAIL on origin/main for the change they pin, all PASS on the applied prototype; mutation of LOCKUP_SRC to the non-reversed file and a 1-byte edit of a copy both made them FAIL, then reverted); `check-diff-scope.mjs` (passes on the prototype, FAILS when `NewsletterSignup.tsx` is touched); `selftest.mjs` (headless Chromium, no build: the census walk bites on a Manrope label and on live Lora/JetBrains Mono text and ignores hidden nodes; the served-px rule passes a 750 candidate and bites a 640 candidate at 248 x 3x).
NOT run: `gate-logos.mjs` and `census-fonts.mjs` against a real build. The architect worktree has no installed dependencies and the main checkout's `node_modules` is stale (no `sharp`, no `pdf-lib`, an older Next), and installs are out of bounds. @dev runs both on the first real build and must show them failing on a pre-change build (Manrope/Lora/Mono in the census; the old file name in gate-logos) before the change.

## Named gaps

1. The census treats `sr-only` text as rendered (it is). The topics error `<p>` and the signup status line appear only after a submit; they share the `.nf` variable fix but the gate does not submit the form. The Codex prompt asks about them.
2. The census covers three routes; other NOS routes share the same footer and chrome but are not asserted here (type-tokens' sweep covers its own list).
3. `SaocLockup.tsx`'s official-mono branch becomes dead code in the SAOC lane.
