# nos-critique-r20 F5: footer parity (sign-up inline, labels, input hints, one-line rows, WOSA hover, REG/NPO)

BASE: `origin/main` `7fb251a1`. Branch `fix/nos-critique-r20`, worktree `.tmp/sandbox/critique-r20`, on F1-F4 (HEAD 45f4f9bd).
Ruling: Codi, FINAL, footer parity, six items, relayed by the lead on 2026-10-22. Goldens: `f5-edits.json` (the exact SAOC Footer.tsx
edits, the NOS input attributes, the NOS rules, what they replace and retire, the acceptance values), `f5-footprint.json`.
Sources: `components/chrome/Footer.tsx`, `components/nos-chrome/NosFooter.tsx`, `components/nos-chrome/nos-chrome.css`,
`components/chrome/footer-data.ts` (`FOOTER_BULLETIN.emailLabel` = "Email address", `.placeholder` = "your@email.co.za");
`docs/rules/no-invention.md`.

## The ruling (Codi's six items)

1. NOS Subscribe sits inline to the right of the input at 1280 (it is already inline at 390).
2. The SAOC visible label uses `FOOTER_BULLETIN.emailLabel`. Flag saoc-82 in the PR (this edits the SAOC Footer.tsx).
3. `spellCheck={false}`, `inputMode="email"` and `autoComplete="email"` on both email inputs.
4. Footer link letter-spacing 0, so SANBI fits on one row at 1280; no other row wraps.
5. The WOSA link has no underline at rest, and is underlined on hover and focus.
6. NOS REG/NPO takes SAOC's weight; its colour stays NOS.

## Measured on HEAD 45f4f9bd (architect probe, production build)

- NOS form at 1280: stacked (input top 4487, button top 4539) by `@media (min-width: 701px) { .nf-form { flex-direction: column; }
  .nf-form input, .nf-form button { width: 100%; } }`. `.nf-form` is already `display: flex; gap: 8px`, so removing that media rule
  is the whole of item 1; the 100% widths have to go with it, or the button would claim the full row.
- SAOC label renders `{FOOTER_BULLETIN.placeholder}` ("your@email.co.za"); the NOS label already renders "Email address".
- Neither input has `inputMode` or `spellCheck`; both have `autoComplete="email"`.
- NOS link letter-spacing is already `normal` (computed 0). SANBI's Karla text is 282.3px in a 280px column at 1280, so it wraps;
  SAOC's Manrope SANBI fits. Item 4's letter-spacing 0 is a no-op on NOS SANBI. **Codi FINAL (SANBI):** accept two lines for SANBI on
  NOS, no `nowrap` (a nowrap row overflows under text-spacing overrides or text zoom, WCAG 1.4.12 / 1.4.4, and would hide the next long
  partner name); the row stays >=44px with the wrapped line top-aligned (`.nf-list li > * { vertical-align: top; }`). Golden `twoLineRow`.
- SAOC REG/NPO: `font-mono`, 11px, `tracking-[0.1em]` (1.1px), weight 400. NOS REG/NPO: `.nf-head` (700, 12px, 0.14em = 1.68px), gold.

## Build route

- `Footer.tsx` (BASE line numbers; distinct from F3's 19, 29, 38, 39, 128, 133 and F4's 22, 52, 57, 71, 74, 118):
  - line 93 `{FOOTER_BULLETIN.placeholder}` -> `{FOOTER_BULLETIN.emailLabel}` (the label only; the input keeps the placeholder);
  - line 98 `autoComplete="email"` gains `inputMode="email"` and `spellCheck={false}` on the following lines.
- `NosFooter.tsx`: the `#nf-email` input gains `inputMode="email"` and `spellCheck={false}`.
- `nos-chrome.css`:
  - `.nf-list a, .nf-list span` gains `letter-spacing: 0;` (item 4, as SAOC);
  - `.nf-wild a` loses its underline at rest (`text-decoration: none`), and a new `.nf-wild a:hover, .nf-wild a:focus-visible` rule
    carries the existing underline (green-1, 1.5px, offset 4px) (item 5);
  - `.nf-brand .nf-reg` gains `font-weight: 400; letter-spacing: 0.1em;` (item 6; it out-ranks `.nf-head`, which keeps 700 and
    0.14em for the headings);
  - the `>=701px` stacked-form media rule is removed (item 1).
- No new string, token or colour. The submit behaviour is untouched (footer-newsletter-subscribe owns it).

## REG/NPO tracking (architect decision)

Item 6 names weight; the lead's acceptance adds "weight and letter-spacing equal SAOC's computed values". NOS REG/NPO stays 12px
(the ruling changes weight, not size), and equal px tracking at 11px vs 12px would not be the same tracking, so P4 compares
`letter-spacing / font-size` (SAOC 0.1em) within +-0.005em, and the weight exactly. NOS gets `letter-spacing: 0.1em` (1.2px at 12px).
This is flagged to the lead.

## Acceptance (f5-static.mjs, f5-rendered.mjs)

- S1 `Footer.tsx` = BASE + F3 + F4 + F5 edits exactly. S2 the NOS input carries each golden attribute once. S3 each golden NOS rule
  once, the rules it replaces gone, the stacked rule gone. S4 both forms' BASE submit lines untouched. S5 no new prose. S6 docs `## F5`.
- Rendered, public and preview, 1280 and 390, SAOC and NOS routes: P1 input and Subscribe on one row in both footers; P2 every list
  row, the WOSA link and every legal link one line, except NOS SANBI at 1280 (at most two lines, >=44px, top on its li's top); P3 WOSA `text-decoration-line: none` at rest, underlined on NOS hover; P4 NOS
  REG/NPO weight equals SAOC's, tracking equal in em, colour the NOS gold; P5 both labels "Email address", placeholder unchanged;
  P6 `autocomplete=email`, `inputmode=email`, `spellcheck=false` on both inputs.
- Kept: the F4 44px rows and column assertions (f4-rendered). Amended for F5: f1-rendered R4 (inline at 1280 too), f3-rendered L5
  (REG/NPO tracking left to P4), f3-static S2 and f4-static S2/S4 (accept the F5 edits and replacement rules).
