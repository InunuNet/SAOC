<!-- Verbatim copy of root comms.md lines 2760-2824 (NOS Design -> SAOC, 2026-10-28, COUNCIL-1). FINAL. Scope of council-design-1: C1, C3 (SAOC), C4 (SAOC), C5. NOS Site owns C2 and TYPE-11. -->

## [SAOC NOS Design -> SAOC] 2026-10-28 — COUNCIL-1: rulings on Scott Ormerod's 7 design rows (sheets of 2026-10-27)
All 7 rows: **CHANGE**. None needs Brad's call: every logo is a supplied media-kit file and fits his rule (full colour, a variant made for the ground, never low contrast). I checked each by eye, rendered on the real footer grounds. Brad's veto stands on C1/C2, which swap the live-text footer lockups for supplied image files.

**Measured on beta today (rendered text nodes, 1200 wide)**
- NOS /, /faq, /tickets: **5 families.** Fraunces and Karla (the site), Lora and JetBrains Mono (the live-text SAOC credit in the footer), Manrope (2 footer nodes: the TYPE-11 checkbox bug).
- SAOC /, /societies, /about, /events: **4 families.** Crimson Pro, Manrope, JetBrains Mono (26–46 nodes in main: eyebrows, fact labels, breadcrumbs, pills), Lora (footer lockup).
- Scott is right on both sites.

**C1 · SAOC footer logo ("change to the top one"): CHANGE**
- The footer lockup becomes the supplied file `public/downloads/media-kit/saoc/lockup/saoc-lockup-south-african-orchid-council-vertical-colour-on-dark.png` (1915×1531, transparent). It replaces the live SaocLockup tone="dark" (lapis E4 emblem plus Lora and Mono text).
- Box: the current lockup width ±4. Serve from a resize-only ladder of that file, never recoloured or cropped, with served px ≥ box×DPR at 3x. Alt is the current accessible label.
- Below 768 the same file is used at its box. There is no narrow tier.
- Gate: by eye at 1440 and 390; no Lora or JetBrains face loads from the footer.

**C2 · NOS footer ("use the color logos"): CHANGE both marks**
- NOS lockup → `NOS-2027-logo-full-colour-reversed-vertical.png` (media-kit/nos, 3272×2876). That is the same size as today's reversed-gold file, so it drops into LOCKUP_SRC with the LG-1 ladder.
- **Not** `nos-2027-logo-full-colour-vertical.png`: its dark wordmark disappears on royal (rendered).
- SAOC credit → the C1 file at the credit's current box, replacing OfficialMonoLockup (grey emblem plus Lora and Mono text).
- Gate: by eye at 1440 and 390; served px ≥ box×DPR.

**C3 · Buttons in capitals (both sheets): CHANGE**
- SAOC: one button text style, the one the header "Join a society" CTA already uses: Manrope 13/700, uppercase, tracking 0.12em, leading 1.
  - It applies to every filled or outlined button and every link styled as a button: hero CTAs, form submits, newsletter Subscribe, ticket buy, MENU.
  - Text links, nav links, breadcrumbs and arrow links stay sentence case.
  - Use CSS text-transform only. Source strings and accessible names are unchanged (R7).
  - Gate: every button computes that style; no label wraps at 390; min-height 44 holds.
- NOS: already ruled. The NR-8 Caps role covers buttons (Caps 14, nos-type-tokens GO 4e7fe348), so it lands with that merge, and I verify on beta. A NOS button still in sentence case after the merge is an R-W miss.
- Noted, not ruled yet: SAOC button radii vary (the 2px token, the header CTA at 10px, some square). P3; I'll rule on it separately.

**C4 · Fonts ("stick to 3"): CHANGE. Two families per site, with the logos as image files**
- NOS: Fraunces and Karla only.
  - C2 removes Lora and Mono.
  - **TYPE-11 moves up now:** the footer Manrope nodes take Karla.
  - TYPE-15 (≤3 font files per route) stays next.
- SAOC: Crimson Pro and Manrope only.
  - C1 removes Lora and Mono from the footer. The mobile drawer lockup, if it renders live Lora text, takes the supplied horizontal file for its ground too.
  - JetBrains Mono retires from page UI, with no exceptions:
    - eyebrows, fact labels (Meets, Venue, Founded), pills and table heads → Manrope 13/600, uppercase, 0.12em. Today's 11px mono rises to 13.
    - breadcrumbs → Manrope 14/500, sentence case.
    - numerals (dates, times, prices, codes, /media-kit hex values) → Manrope with tabular-nums.
    - vendor form labels → Manrope 14/600, sentence case.
  - Delete the Mono font file and the --font-mono token once nothing uses them.
  - This supersedes my F1e cap of 4 families for SAOC. The ≤40KB per file and the one preload stay.
- Gate, on both hosts, every route, at 390 and 1440:
  - the first family of every rendered text node is one of the site's pair;
  - ≤3 font files loaded per route;
  - zero `font-mono` in components/ and app/;
  - the F1e beta LCP gate re-runs;
  - the header height and the F1b nav widths hold.

**C5 · Society links ("maybe have icons"): CHANGE**
- On /societies/[slug], the external link row ("Visit society website →", "Facebook page →", "Instagram page →"):
  - Each link gets a leading icon: a globe for the website, and the Facebook and Instagram glyphs.
  - The icons are monochrome currentColor ink, never brand colours, in a 20px box. The globe is an outline at stroke 1.75. The two brand glyphs use the official shapes (Simple Icons, CC0) at the same optical size.
  - Labels stay verbatim and visible: no icon-only links.
  - The trailing → drops, because an icon leads instead; CRIT-13 keeps the arrow for our own routes.
  - The icon is aria-hidden, and the link name is the label.
  - Spacing: an 8px gap from icon to label, 24px between links, a hit area ≥44 high, and the underline on the label only.
- The Telephone and Email facts get no icons; they already carry labels.
- Gate, on the 21 society pages: each external link has 1 aria-hidden svg and visible label text; 0 "→" in the row; by eye at 1440 and 390.

**Build split**
- To SAOC: C1, C3 (SAOC), C4 (SAOC), C5.
- To NOS Site: C2 and TYPE-11. NosFooter lives in components/nos-chrome.
- I check each by eye on beta after merge.
