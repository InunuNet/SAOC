# nos-type-tokens: NR-1 weight band, NR-6 body, NR-7 one h1/h2, NR-8 three labels (plus S-2 and TYPE-11)

Sources: `docs/rules/no-invention.md` and the NOS Design ruling 2026-10-28, root `comms.md` block "NOS design review NR-1…NR-12, full text + S-1…S-4 rulings + type spec (verbatim)". Every number here is that ruling's; nothing is invented. Evidence: `inventory.md` (measured on origin/main 48d74378). NR-2 to NR-5 (layout) are FROZEN pending Brad and are not started here. NR-9, NR-12, S-1, S-3 and S-4 are separate items.

## 1. Decision: base on #133, not main
Branch from the head of PR #133 (`feat/nos-hub-tablet-serif`, f22e989a). Never push to #133's branch. This PR merges after #133 and its body says so; open it against main once #133 has merged (or against #133's branch for review only). Reason: #133 edits the very lines NR-1 rewrites (`nos-theme.css` heading weight rules at 355-370, the `nos-opsz-fluid` 889px rule, `.doc-h2`, `.nk-head h2`, the 400 restatements). Building on main would conflict in all of them and reverse #133's tested LT-1 rule. NR-1 supersedes LT-1 (a subset: "300 at >=32") and keeps its result. If #133 has merged by dispatch, branch from main.
This choice conflicts least: NR-1 supersedes LT-1 on exactly the same rules.

## 2. Scope
In: NOS surface only (`app/(nos)/**`, `components/nos/**`, `components/nos-chrome/**`, `components/show/**`). A type scale as tokens, the weight band on every Fraunces node, the body/standfirst/measure roles, one h1 and one h2 treatment, three label treatments, the S-2 numeral colour, and the footer family (TYPE-11).
Out: footer text SIZES including the 13px base and registration lines (TYPE-11's font family is IN, via the CSS route in §8), SAOC routes and chrome, edits to `components/newsletter/NewsletterSignup.tsx`, `components/legal/LegalBody.tsx`, `components/chrome/**` (SAOC lanes: override inside `.nos-theme` or `.nf` instead), the SAOC lockup artwork (S-3 is its own item; the gate exempts it), the "Testing only, not live" banner, NR-2..5, NR-9, NR-10, NR-11, NR-12, TYPE-12 (font-synthesis), TYPE-13, and preload/CLS work in TYPE-15 beyond what the Karla change needs.
`check-static.mjs scope` fails on any file outside the allowed list.

## 3. Tokens (one block, `.nos-theme` in `nos-theme.css`)
Add the role tokens once; selectors use them, so no literal sizes are left per class. Values are the ruling's section 1 clamps, verbatim:
- Sizes: `--t-display clamp(40px, 28.1px + 3.05vw, 84px)`, `--t-h2 clamp(32px, 29px + 0.762vw, 44px)`, `--t-name clamp(32px, 30.5px + 0.381vw, 40px)`, `--t-h3 clamp(22px, 20.9px + 0.286vw, 26px)`, `--t-title clamp(20px, 19.26px + 0.19vw, 22px)`, `--t-standfirst clamp(20px, 18.9px + 0.286vw, 24px)`, `--t-body clamp(16px, 15.53px + 0.12vw, 18px)`, `--t-meta clamp(14px, 13.63px + 0.095vw, 15px)`, `--t-lede-hub clamp(20px, 18.5px + 0.38vw, 26px)`, `--t-theme clamp(20px, 17px + 0.62vw, 28px)`, `--t-fact` = the title clamp.
- Weights as tokens too: Display/H2/Name/Figure 300; H3/Title/Standfirst/hub lede/theme line/fact dd 400; Body 450; Label 600; Form label 500; Caps 700; Meta 400.
- Line heights: display 1.0 (1.05 wrapping), h2 1.15, name 1.1, h3 1.25, title 1.25, standfirst 1.45, body 1.6, meta 1.5, hub lede 1.42, theme 1.3, fact dd 1.2.
- Colours: `--ink-700 #3a3654` (prose), `--ink-500 #6a6780` (meta), royal for headings, and one new token `--olive-ink: #6a6829` (S-2 now, NR-8 and NR-9 later). These hexes are from the ruling; check which already exist in `nos-theme.css` before adding.
- Optical size: Display 72, H2 and Name 48, Title/H3/dd 24, hub lede 28, standfirst auto, figures 72. No h1 pinned to 24 (TYPE-5).
- `--nos-measure: 38rem`; prose `max-width: min(100%, var(--nos-measure))` on `p`, `li`, the standfirst and the closing line. This replaces `.nos-theme p { max-width: 60ch }` (`nos-structure.css:174`).

## 4. Role to selector map (the work)
Apply the role to the selector; delete the per-selector literal size/weight/opsz it replaces. Where a selector is not listed and already complies with R-W, leave its size alone; where it does not, correct the WEIGHT only (to the band) and keep its size unless this table says otherwise. This stops the change from re-designing things the ruling did not name.
- Display (h1, every route, both hub and inner): `.nos-hero-title` and its `.is-long` variant (nos-theme.css hero rules), `.nk-masthead h1` (S:2055), the `/tickets` bare h1, the 404 h1. opsz 72 everywhere. Long titles wrap to two balanced lines instead of shrinking at >=768; below 768 `.is-long` may be smaller but not under 32. The system-ui error-boundary h1 is not a NOS surface.
- H2 (every h2 heading a section): base `.nos-theme h2` (T:357), `.doc-h2` (S:2769), `.nk-head h2` (S:1958), `.nos-hm-h2` (S:4337, delete the rule), `.nos-cr-main h2` and `.nos-pr-head h2` (S:3958, S:981, delete the size). 300, opsz 48. /programme "Tickets" and the 39/400 h2s become 300. The visually-hidden `h2.sr-only` is exempt.
- Title (card, aside and list titles): `.nos-sp-card-title`, `.nos-sp-reach h3`, `.nos-sp-qa h3`, `.nos-sp-tier h3` (25px now), `.nos-ex-q`, `.nos-faq-question`, `.nos-ct-label` and contact aside heads, index and gateway links (`.nos-index-group a`, `.nos-ab-gateway a`). 400, opsz 24, 20-22px. An h2 that is a card or aside title carries the class `nos-card-title`.
- H3 visual: "Explore the show" (`.nos-index-eyebrow` h2, restyled 22-26/400 as TYPE-7 says; the element stays an h2, no heading level changes) carries class `nos-h3-visual`. `.doc-prose > .doc-h3` is the H3 role.
- Name (presenter names only, never larger than the h2): `.nos-pr-head h3`. 300, opsz 48, 32-40.
- Standfirst: `.doc-standfirst`, `.nos-ab-main .doc-standfirst`, `.nos-ab-closing`, `.nos-pr-lead`, `.nos-hm-lead`, `.nos-ex-standfirst`, `.nos-we-s3 p`, `.nos-close-line`, `.nos-hm-closing-text`. Fraunces 400, 20-24, lh 1.45, ink-700. Standfirst:body is 1.25-1.4 at 1440 (23 over 17.3 = 1.33).
- Body: `p`, `li` and prose `dd` in running copy. Karla 450, `--t-body`, lh 1.6, ink-700. Delete the per-page size and line-height on prose selectors (17/1.7 on about and exhibitors, 16/1.7 symposium, 15.5 plan-your-visit and sponsors, 15/1.5 ticket cards keep Meta). LegalBody's `text-ink/85` is overridden to ink-700 inside `.nos-theme`; do not edit the shared file.
- Hero: hub lede (`.nos-hero-hub .nos-hero-lede`) Fraunces 400 opsz 28; theme line (`.nos-hero-inner .nos-hero-lede[data-nos-lede='theme']`) Fraunces ITALIC 400 from the main variable italic; fact dd (`.nos-hero-facts dd`, `dl[data-hero-facts] dd`) Fraunces 400 opsz 24 tabular. Inner hero lede stays Karla 400 as built.
- Figures: `.nk-num`, `.nk-price`, `.nk-pool-num`, `.nos-pg-date .d`, `.nos-ar-year`, `.nos-edition-year`, `.nos-numbers dd a`, `.nos-figure`: 300 at their current sizes (all are >=32 in the data). `.nk-cur` (17.9-25.8px at 300 today) and `.nk-admit` (16px at 400) are under 32 and take the band (400 and 500).
- Every other Fraunces element: weight to the band (R-W), size unchanged. Known cases: `.nos-faq-qn` (17/300 to 500), `.nos-num` (S-2), `.nos-pg-session .n`, `.nos-pg-later .n`, `.nos-we-card dd` (18/300 to 500), `.nos-venue address`, `.doc-numbers dd`, `nk-stamp`, `nk-theme`, `nos-index-arrow`, the Menu panel items, the contact `em`.
- The Tailwind `font-medium` utilities are overridden by `nos-theme.css:403` today. Fix that only where NR-1 needs the weight; no blanket change.

## 5. Karla as one variable face (NR-6, TYPE-2)
`components/nos-chrome/fonts.ts` and `components/nos/NosThemeScope.tsx` each declare Karla as four discrete faces from one file. Replace with a single entry `{ path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '400 700', style: 'normal' }` in `components/nos-chrome/fonts.ts`, now the single `localFont` owner (`NosThemeScope.tsx` imports `fraunces` and `karla` from it; A3 fails if it calls `localFont`). Measured: with discrete faces `font-weight: 450` renders the 500 instance; with a range it renders a true in-between instance (widths 814.7 / 822.9 / 831.1 at 400 / 450 / 500). The ruling says "omit `weight`"; the file's axis floor is 400, so the explicit `'400 700'` range is used and the gate proves the result empirically (A13 "weight 450 is a real instance", exactly one Karla face loaded).

## 6. Labels (NR-8, TYPE-6, TYPE-7)
Three tuples, nothing else:
- Label: Karla 600, 14px, tracking 0, sentence case. Fact `dt`, "Opening hours", index group heads (`.nos-index-group h3`, today 12px caps, violet), key names, 
- Form label: Karla 500, 14px, sentence case, ink (`.nos-form-label`, R82, unchanged); applied to /contact labels (today 12/700) as well, and to the header nav link `.nh-label` (today 14.5px; nav links are not labels, and olive is for the Label role only).
- Caps: Karla 700, 14px everywhere, tracking 0.12em (1.68px), uppercase; ONLY for buttons, footer column heads (`.nf-head`, today 12px/0.14em, becomes 14/0.12em; NR-8 names them), status pills and countdown units. No tracked caps above a heading (no eyebrow). `nos-hero-eyebrow`, `.nos-index-eyebrow` and the 404 chip stop being tracked caps.
Violet `#7E3F97` text is removed (the focus ring only). Checkbox/radio option labels are exempt from the tuple rule but are Karla and >=14px.

## 7. S-2 numerals
`.nos-num` (`nos-structure.css:821`): colour `--olive-ink` `#6A6829` (5.53:1 on `#FBFAF0`), weight by band (19.84px to 500, 24.18px to 400). It does not fall out of NR-1; the colour is the fix for the 4.10:1 failure.

## 8. TYPE-11 footer (in scope, CSS-only route)
Cause (inventory section 4): the footer sits outside `.nos-theme`, so the Tailwind `font-sans` utility on `NewsletterSignup.tsx:141` resolves `--font-sans` to Manrope. SAOC confirmed its lane does not fix this for NOS. Fix without touching the SAOC-lane component: in `nos-chrome.css` set `--font-sans: var(--nc-sans)` and `--font-serif: var(--nc-serif)` on `.nh, .nd, .nf` (the block near line 166 already sets `--nc-*` there). `NewsletterSignup.tsx` stays untouched (A16 asserts it). Footer SIZES are out of scope, including the 13px base and registration lines; the gate skips footer text sizes. Only the family is in: `.nf-head` is the one footer element held to the Caps tuple (14px) because NR-8 names footer heads. The SAOC lockup (Lora, mono tagline) is a logotype, exempt, and untouched (S-3 is separate). The gate requires every footer and newsletter text node (checkbox labels, text, input, button) outside the lockup to compute a Karla font-family on the NOS host.

## 9. Gates
`checks/build.sh` builds production on Sanity fixture replay (0 live reads). `checks/gate-type.mjs` walks 22 required routes plus /archive and a 404 at 390, 768, 1280, 1440 and 2056, with the Menu panel opened once, and asserts:
- R-W on every rendered Fraunces node (strict band: 31.99px is 400; boxes of 2px or less, the sr-only pattern, are skipped);
- R-F: no text under 14px and no heading under 14px except caps at 13px+;
- Body weight 450, size to the `--t-body` clamp (0.6px), lh 1.6, ink-700, and the measure `min(container, 608px)` for every prose p/li, standfirst and closing line;
- the 450 instance is real (400 < 450 < 500 in width) and exactly one Karla face loads, at most 3 font files per route (/, /about, /faq at 1440);
- h1: every h1 at the Display clamp, 300, opsz 72 (`.is-long` may be smaller only below 768, never under 32); h2: one role per class (H2 300 opsz 48, `nos-card-title` Title, `nos-h3-visual` H3); Name and H3 roles; h3 never larger than its preceding H2-role h2 (TYPE-4);
- hero lede hub, theme line (italic) and fact dd to their clamps, weight and opsz;
- labels: only the three tuples, caps only inside the allowlist (buttons, `.nf-head`, pills, countdown units), at most 3 distinct label tuples per route, no text in `rgb(126, 63, 151)`;
- S-2: `.nos-num` colour `rgb(106, 104, 41)` and contrast >= 4.5 from rendered colours on /faq and /plan-your-visit;
- TYPE-11: every footer text node and every footer input and button computes Karla; footer sizes are skipped.
- renders: full-page shots of all 24 routes at 390, 1440 and 2056 are written to `evidence/shots` for NOS Design's R-W walk (A15 checks they exist).
- The glyph-width probe asserts 450 is not 400 or 500 by measured width, not by reading CSS.
`selftest.mjs` proves the arithmetic first: each clamp reproduces the ruling's 390/1440/2056 column (within 0.5px), the band edges, the contrast numbers (5.53 and 4.10), and the label tuples. Red proof: `goldens/baseline-gate-type-main.json` is the gate run on main 48d74378: 120 pages, 3,581 Fraunces nodes, 1,313 R-W violations, 10,390 failures. It must reach 0.
Port base: `NOS_TYPE_PORT` (default 3141); the gate uses offset +14.

## 10. NOS Design answers (appended to root comms.md) and the one open decision
1. Labels are olive `#6A6829` on light grounds and `#A7A841` on dark; NR-8 supersedes the section 1 table. The Label tuple is asserted for colour; Form label stays ink.
2. Hero fact dd keeps the clamp: 20 / 22 / 23.2px (+-0.5) at 390 / 1440 / 2056. 24 is only the cap.
3. `.nk-name` gets the weight-band fix only; it stays 29px/400 and the stub is not resized.
4. Karla `'400 700'` as one variable face is accepted. The gate proves a real 450 by advance width (400 < 450 < 500, 450 not equal to 500, margins over 1px), and the face counts toward at most 3 font files per route.
5. The band is strict (under 32px is 400). No role clamp may straddle a band edge, checked at 390, 1440, 2056 and at each clamp's min and max; where one would, raise its floor to 32 rather than switch weight. Asserted in selftest.mjs against values.json.
6. NosShowIndex is restyled now; NR-3 removes it later.
7. DECISION NEEDED: `h2.nos-index-eyebrow` is a label marked up as an h2 on 14 routes. This PR changes no heading level.
Measure scope: 38rem applies to prose p and li, the standfirst and the closing line only. The 60ch rule goes. p inside cards, stubs, forms and the footer take their container width; the gate scopes the check that way. Bar: 0 R-W violations.

## 10b. Decisions after the dev's first build (NOS Design GO on 4e7fe348, R-W bar met)
- Scope (A9) also allows `components/contact/NosContactAside.tsx` (NOS contact aside, NOS lane).
- Karla is counted as distinct url() sources across the Karla `@font-face` rules, not rules or FontFace objects (next/font adds a `local()` fallback face that is not a file). Exactly 1 file. The advance-width 450 probe is unchanged.
- OUT OF SCOPE: the 3-font-file cap. SAOC's F1e (`feat/sdc-f1e-critical-path`) is rewriting font loading in `app/layout.tsx` (which also loads Crimson, Manrope, Lora and JetBrains Mono, so 7-8 files load today) and TYPE-15 builds on it after NR-9/NR-12. The check is a switch (`values.json` fonts.cap.enabled), off; counts are recorded in `evidence/gate-type.json`.
- Exempt node: /sponsors h2 "Talk to us about sponsorship" is skipped by the h2 role check (`values.json` exemptNodes): SAOC's sponsor-enquiry PR is rewriting that page and is asked to add `nos-card-title`. Remove the exemption when it merges.
- Measure exemption (ruling 5): `.nos-hm-rows p` and `.nos-sp-reach p` are exempt from the measure check, keeping their old layout; the exemption expires with NR-2.
- Caps are 14px everywhere (~1px moves accepted). The nav link `.nh-label` uses the Form-label tuple (Karla 500 14 ink); olive is for the Label role only. The gate rejects a 13px Caps node and a `.nh-label` that is not Form label.
- Noted, not gated (frozen lanes): the /faq hero Venue wrapping to 2 lines at 1440 (NR-5 nowrap at 1024 and up), and the white FAQ cards (NR-4).

## 10c. #133 assertions this PR supersedes (NOS Design rulings 1 and 2)
Where #133's spec and contract live for this branch: an UNTRACKED copy at `.agent/memory/project/specs/nos-hub-tablet-serif/` in this worktree (the authoritative copy is #133's own worktree `.tmp/sandbox/hub-tablet`, which is never edited or pushed from here). The edits are to this branch's copy only, in `goldens/values.json`:
- h1 pins (A10 `hub.desktop.viewports[].h1Px`) re-pinned to the Display clamp `clamp(40px, 28.1px + 3.05vw, 84px)`: 1440 -> 72.02 and 2056 -> 84 (2056 going down from 96 is intended). The ruling names the columns 390 / 1440 / 2056 but #133 pins 1024, 1280, 1440 and 2056; I assumed the ruling's columns for 1440 and 2056 and evaluated the same clamp for the other two: 1024 -> 59.32, 1280 -> 67.14. 390 had no #133 pin.
- Countdown fit (A24 `hub.countdownFit.final`): `blockWidthBelow1024` 273.6 -> 278.89 (768-1023) and `blockWidthFrom1024` 297.6 -> 302.89, tolerance 1, slackAt768 14.8 -> 9.4 (640 - 319.7 - 32 - 278.89), with no Caps exemption; checks/countdown-fit-verdict.mjs selftest pins updated to match. NR-12 (no seconds) re-pins again.
- A11 (LT-1 sweep) "serif headings under 32px weight 400": replaced by the R-W band (400 at 20-31.99, 500 below 20); "no Karla heading at 300" and "300 at 32px and up" stand. This one is still provisional: A11's own check script is not edited here, so the dev reports whether it fails when re-run.
- A21 header strip parity at 390 and 767 stands, except `nh-label` (Form-label tuple, Karla 500 14).
The hub contract's `checks.sha256` is regenerated in this copy so its A1 stays honest.

## 11. Risks
- Fraunces 300 to 400 at 20-31px widens text about 3 percent: hero facts, the lede and standfirst may wrap and move the hub fold. Re-run #133's geometry gates (A10, A24 in `nos-hub-tablet-serif/checks`) on the result; the 1100px cap is retired, the first-screen rule stands.
- Body 450 and the 38rem measure change wrapping on every prose route, including the layout-frozen two-column pages. The gate measures against the container so a narrower column still passes; a visual check on /about, /what-to-expect and /plan-your-visit is advisable.
- Karla range: a wrong `weight` string silently renders 400 or 500. The 450 probe is the guard.
- One shared `fonts.ts` is imported by the SAOC marketing layout; the change touches NOS faces only (`preload: false` unchanged).
