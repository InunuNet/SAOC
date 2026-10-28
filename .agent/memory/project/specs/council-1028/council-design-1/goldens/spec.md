# council-design-1: SAOC side of COUNCIL-1 (C1, C3, C4, C5)

Final ruling: `ruling-council-1.md` (verbatim). Built on top of main AFTER the saoc-design-consistency wave (feat/sdc-f1a..f1e) lands. NOS Site owns C2 and TYPE-11.

## Step 0 for @dev (before any edit)
Run `node --env-file-if-exists=.env.local .agent/memory/project/specs/council-1028/council-design-1/checks/baseline.mjs capture` with `DC_PROD=1` on the clean post-wave main and commit `goldens/baseline-post-wave.json`. It freezes the header heights/part widths and the computed style of every NOS element that carries `font-mono`/`mono-label` today. The architect could not capture it (the wave is not on main yet); the lead may do it instead. Without it A9 and A10 fail by design.

## Decisions

### D1 C1 footer lockup
- Copy the supplied file byte-for-byte to `public/images/saoc/lockup/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark.png` (same sha256, see `c1-footer-lockup.json`). Reason: `lib/image-loader.ts` and `scripts/generate-image-variants.mjs` only ladder sources under `public/images/`; the NOS lockups already live in `public/images/nos/lockup/`. Do not edit the copy, do not touch `public/downloads/`.
- New server component `components/chrome/FooterLockup.tsx` mirroring NosFooter's `getImageProps` + `sizes: 280px` pattern (LG-1): sized by HEIGHT (NOS Design amendment 2026-10-28): rendered height = the old lockup's baseline height +-4 at 1440 and 390 (`baseline-post-wave.json` footer[w].h), `max-width:100%; height:auto`, no horizontal overflow at 390/768/1023; the `sizes`/srcset covers the ladder so DPR 3 picks a file >= rendered width x 3. Link to `/`, `alt` = `ACCESSIBLE_LABEL` imported from `components/chrome/SaocLockup.tsx` (the `export` is added by NOS Site's C2, spec fix/nos-footer-colour-logos 07b1b326, landing on main first; never re-export or duplicate the string); no aria-label on the link. No text inside the link.
- `Footer.tsx` stops importing SaocLockup. `SaocLockup.tsx` and the Lora face STAY: `NosFooter` still imports them until NOS Site's C2 lands; whoever lands second deletes `SaocLockup.tsx`, `app/fonts/lora/` and `scripts/checks/footer-render-check.mjs`. The SAOC route gate (A2, A4) proves no SAOC route loads Lora meanwhile.
- Header and mobile drawer: UNCHANGED. Both already render the raster `/images/saoc-lockup-horizontal-full-name.png` (no live Lora text), so the ruling's drawer clause ("if it renders live Lora text") is false. A6 guards that they still do.
- The old `-mt-[30px]` emblem-crop hack goes; the new PNG has its own transparent padding. The artwork top should sit on the column headings' top line; judged by eye (report script `checks/shoot-footer.mjs`).

### D2 type roles (C3 + C4), one definition site
Five classes in `app/globals.css` under `@layer components`, spec in `type-roles.json`: `btn-caps` (13/700 uppercase .12em lh 1, min-h 44), `t-label` (13/600 uppercase .12em), `t-crumb` (14/500 sentence), `t-num` (Manrope, tabular-nums), `t-field` (14/600 sentence). All set `font-family: var(--sans)`. The names are fixed (the checks key on them). `font-mono` is replaced call-site by call-site (about 60 files incl. admin) by the role that matches the old use: eyebrow/fact label/pill/table head -> `t-label`, breadcrumb -> `t-crumb`, date/time/price/code/hex -> `t-num` (compose with the surrounding role), vendor form label -> `t-field`. Delete the Mono font file, `--font-mono*`, `--mono*`, `.mono-label`, and the 12px mono floor rule in globals.css.
- Case is `text-transform: uppercase` in CSS only; no source string and no accessible name changes (R7).
- Text links, nav, breadcrumbs, arrow links keep sentence case.
- Filter chips, toggles, tabs and other `aria-pressed`/`role=tab` controls are PILLS (`t-label`), not buttons. Open question below.

### D3 the NOS coupling (the one place this feature can break the other site)
Shared components (vendors, tickets, newsletter, contact) render under `.nos-theme`, which today re-skins `font-mono` to Karla by redeclaring `--font-mono`/`--mono` (`app/(nos)/national-show/nos-theme.css`) and `.nos-theme .font-mono` (R25 label role) and `nos-structure.css:244`. Removing the class on the SAOC side would silently change NOS. Therefore:
- The same rename is applied to those NOS CSS selectors: `.nos-theme .font-mono` becomes `.nos-theme :is(.t-label,.t-crumb,.t-num,.t-field)` carrying EXACTLY the computed values NOS has today. `btn-caps` must be inert inside `.nos-theme` (selector scoped `.btn-caps:not(.nos-theme .btn-caps)`, or equivalent): the NOS button role is NOS Site's NR-8.
- A10 (`baseline.mjs nos`) proves every previously-mono NOS element computes the same family/size/weight/tracking/transform/line-height; A7 proves `btn-caps` is inert on NOS.
- NOS Site is editing the same files for C2/TYPE-11/NR-8: the lead must sequence or tell them these selector renames are coming.

### D4 C3 detection
Two-way gate (`check-c3-buttons.mjs`): every button-LOOKING control (filled or outlined, <= 40 chars, <= 80px tall, not aria-pressed/tab/option/radio/menuitem/data-filter) must carry `btn-caps`; every `btn-caps` must compute the spec, be >= 44 high and one line at 390 (incl. the open mobile drawer and the labelled MENU at 1100). Exceptions only through `button-allowlist.json` (max 12, reason pill/toggle/tab/card/icon-only). The header "Join a society" CTA already has the style: it gets the class and must not move (A9: widths within 1px).
- Scope: public SAOC routes. `/admin` gets the C4 font swap (no mono anywhere) but not a C3 gate; see open questions.

### D5 C5 society links
`components/societies/SocietyAbout.tsx`: leading icon, 20px box, `aria-hidden`, currentColor. Globe = lucide-react `Globe` (already a dependency) at size 20, strokeWidth 1.75, outline. Facebook and Instagram = inline SVG using the Simple Icons 14.15.0 path data in `c5-society-icons.json` / `c5-icons/*.svg` (CC0), unmodified, no `<title>`, `fill=currentColor`, viewBox 0 0 24 24. Row keeps `gap-x-6` (24px), `min-h-11`, `underline` on the label span only (wrap the label in a span; the svg is a sibling outside the underline), icon gap 8px, trailing `ArrowIcon` removed. The arrow-swap golden (`goldens/arrow-links-f1d-7ee06e9a.json`) loses its SocietyAbout rows; update it and F1e A29 passes again.

### D6 F1e supersession
C4 replaces F1e's "<= 4 font files per SAOC route" with <= 3 and two families. `check-fonts-network.mjs` becomes `distinct.size <= 3`; F1e contract A2 and A19 descriptions say <=3 and cite COUNCIL-1; `docs/saoc-design-consistency.md` records it (A5). The <=40KB per file and the one preload stay. Expected files per route: CrimsonPro normal, CrimsonPro italic, Manrope.
Every other check that pins a retired fact is listed in `superseded-checks.json` (27 files at capture); `check-superseded.mjs` makes that exhaustive.

## NOS Design questions (all answered 2026-10-28; defaults were accepted)
1. **/admin and C3.** Default: C3 gate is public routes only; admin loses mono under C4 but keeps its own button styling. RULED: confirmed.
2. **Pills vs buttons.** Default: filter chips/toggles/tabs are `t-label` pills, never `btn-caps`. RULED: confirmed.
3. **MENU width.** Uppercasing the labelled Menu button at 781-1279 may widen it by a few px; A9 allows +12px on that one control and still demands one row and unchanged brand/nav/cta/search widths. NOS Design to confirm 12 is acceptable, or give the number.
4. **Footer registration line and email** (RULED 2026-10-28, `goldens/footer-reg-line.json`): the reg line is NOT t-label. Manrope 13/500, `tabular-nums`, no transform, no extra tracking, the footer's existing muted colour; split `FOOTER_REG` on 2+ spaces in `Footer.tsx` into two `whitespace-nowrap` items so it wraps between items only (the shared constant and NosFooter stay untouched). The email is a plain Manrope link.
5. **MENU growth** (RULED): +12px is accepted as a ceiling on that control only; one row at 390/768/1280/1383/1440, no overlap, MENU-to-CTA gap >= baseline, brand/nav/CTA/search unchanged (A9). If 1383 cannot hold, report before building; never trim MENU tracking alone.
6. **/admin** (RULED): font swap only, no C3 caps. **Chips, toggles, tabs** (RULED): pills (t-label); the selected state keeps or gains a fill or underline, never weight alone.