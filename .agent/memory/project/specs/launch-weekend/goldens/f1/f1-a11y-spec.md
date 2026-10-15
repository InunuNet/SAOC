# launch-weekend F1 — accessibility basics (golden spec)

Evidence: .tmp/sandbox/excellence-audit/design/REPORT.md (finding #6). Measured on today's tree: no skip link
anywhere; home 24/40 and societies 29/52 targets under 44px (footer/utility links ~19-22px tall, province chips
55x31, hero dots 16-24 x 2); no prefers-reduced-motion rule (transitions 0.15-1.4s run under `reduce`).

## Skip link
- `<a href="#main-content">` with visible text matching /skip/i, the FIRST tab stop on SAOC and /national-show/* routes.
- Hidden until focused (off-screen / clipped), then fully inside the viewport, uncovered, >=44x44, contrast >=4.5,
  colours only from existing :root tokens (--ivory/--primary/--ink/--parchment/--bone/--accent...). No new tokens.
- Exactly one `<main id="main-content" tabindex="-1">`; Enter moves document.activeElement to it; the next Tab
  continues inside main, not back in the header.
- Plain `<a>` (not next/link) so the browser does the hash focus handling.

## Target size (SAOC routes, 390 and 1280)
- >=44x44, or WCAG 2.2 SC 2.5.8 exempt: inline link inside a sentence, or >=24x24 with a 24px circle that meets no
  other target. Anything under 24px in either axis fails.
- Province chips on /societies: >=44x44 outright. Hero carousel dots: enlarge the hit area (padding or ::after on
  the button), keep the painted 2px bar identical.

## Reduced motion
- One global `@media (prefers-reduced-motion: reduce)` rule in app/globals.css: `*, *::before, *::after` get
  animation-duration/transition-duration ~0.01ms, animation-iteration-count 1, `html` scroll-behavior auto. Nothing
  is removed under no-preference (transition count and scroll-behavior equal the baseline).

## Identity
- :root and @theme in globals.css byte-identical; no colour/type literal added; every SAOC route keeps the same set
  of type+colour signatures (identity-baseline.json) and page height within tolerance (5% at 1280, 8% at 390).
