# R14 type mapping for F2 — relayed verbatim from SAOC NOS Design (design lead ruling), 2026-10-15

SOURCES: R14 (NOS Design .agent/memory/project/design/nos-design-rulings.md §R14) sets the principle: Cormorant and Jost are reserved for the logo artwork and never loaded on a content page; display is Fraunces with the optical-size axis low at display sizes; body is Karla. Per-role values are the design lead's ruling taken from the approved mock CSS inline in artifact 2xfPi1KL6fwiBu3vLFNUHE index.html (rules at lines 68, 83, 100, 140, 142, 157, 170, 183, 197, 215, 222, 264; plan-your-visit.html, symposium.html, tickets.html use the same tokens). Where this table and that CSS disagree, the CSS wins. Reference copy: index.html in this folder.

LOAD: Fraunces (ital, opsz 9..144, wght 300..500) and Karla (wght 400..700). Nothing else. Headings set font-optical-sizing:none and pin opsz explicitly per role.

SCALE (rem): xs .75 (12), sm .875 (14), base 1 (16), body 1.0625 (17), md 1.25 (20), lg 1.5625 (25), xl 1.9375 (31), 2xl 2.4375 (39), 3xl 3.0625 (49), 4xl 3.8125 (61).

CORMORANT -> FRAUNCES
- Hero h1: 300, opsz 96, clamp(3.2rem, 2rem + 4vw, 5.5rem), lh 1, tracking -0.01em.
- Inner-page h1: identical to hero h1.
- Hero lede/standfirst (serif): 300, opsz 28, clamp(1.3rem, 1.1rem + .8vw, 1.625rem), lh 1.42, max 34ch.
- Section h2: 400, opsz 48, clamp(2rem, 1.5rem + 1.6vw, 2.4375rem), lh 1.15, tracking -0.01em.
- Card/list/destination titles (h3/strong): 400; opsz 32 at lg (25px), opsz 24 at md (20px); lh 1.2-1.25.
- Large numerals/figures: 300, opsz 72 (96 at >= 4.75rem); lining-nums tabular-nums; lh 1.
- Every h1-h4 default: 400, royal, text-wrap balance.
- Italic: Fraunces italic, same weight/opsz as its role.

JOST -> KARLA
- Body: 400, 1.0625rem (17px), lh 1.65, ink-700.
- Small/secondary: 400, .875rem.
- Eyebrows/labels/group heads: 700, 12px, tracking .14em, uppercase (olive-700 on light, olive-400 on dark).
- Buttons/CTAs: 700, .875rem, tracking .12em, uppercase, min-height 50px (44px for -sm).
- Nav and leaves: as in handoff/chrome.css.
- Floor: 12px everywhere.

UNMAPPED ROLES: map by function — display/heading -> Fraunces at nearest role above; any other text -> Karla body or label. If a role won't map cleanly, send the selector to NOS Design before inventing a value.

## F2 addition — R15 inner hero (NOS Design review, 2026-10-15)
/national-show/about (and other inner pages) inner hero currently uses a purple gradient wash. R15: one 90deg near-black ramp rgba(11,10,20, .92/.78/.42/.20/.06), never purple. At <=620px: copy on solid black above a 4:3 photo, no scrim. Source: artifact plan-your-visit.html .ihero rules (same as index.html .ihero block, lines ~196-210 of saved index.html).

## F2 addition — hub hero redesign items (NOS Design review, 2026-10-15; match artifact index.html .hero rules ~lines 130-160)
3. Drop "THE FLAGSHIP / EDITION XIX" eyebrows (h1 already says 19th); no eyebrow; generous top padding; h1 max 11ch.
4. Type: h1 Fraunces 300 opsz 96; lede Fraunces 300 opsz 28; labels Karla 700 12px. Current DATES/HOST labels and eyebrows use an off-system monospace face -> Karla.
5. Scrim: one 90deg near-black ramp (R15).
6. <=620: copy on solid black, photo stacked below at 4:3, never behind text.
7. Desktop: hero fits min-height clamp(...) per mock; countdown currently clipped at 800px fold. Keep countdown only if Brad's tickets page uses it; place below facts, inside the fold.
