# nos-critique-r7 F3 - define the --gold tokens (P1, live on main)

BASE = bcf8684b. Footprint: goldens/f3-footprint.json (nos-theme.css only), on top of F2's one line in the same file.

Bug: git grep at bcf8684b finds `--gold` only in components/show/ShowStatusLine.tsx (`bg-[var(--gold)]`); it is defined nowhere. The r6 R11 disclosure surfaces therefore render with no gold fill, and the r6 DISCLOSURE checks passed because their probe resolved the same undefined var on both sides.

Fix: in nos-theme.css, in the rule that holds `--ink-700` / `--ink-500`, add `--gold: #f3f2d6;` and `--gold-100: #fbfaf0;` with a comment citing nos-v4 index.html:16-17. Add `--gold-300: #e8e6c2;` (index.html:18) only if something uses it.

Undefined-var scan (components/show, components/nos, national-show tree, bcf8684b): `--gold` is the only real defect. Others are legitimate and allow-listed in f3-static.mjs: `--font-nos-fraunces`, `--font-nos-karla` (injected by next/font), `--nc-gutter`, `--nc-wide` (defined in components/nos-chrome/nos-chrome.css), and the pre-existing fallback vars `--nos-hero-pos` (inline style) and `--green-1`.

After F3 the F1 dev removes the inline fallbacks `var(--gold,#f3f2d6)` and `var(--gold-100,#fbfaf0)`; f3-static fails on any inline fallback of a gold token.

Rendered (absolute literal, never a var probe): background-color rgb(243, 242, 214) on every [data-status-disclosure] on exhibitors and what-to-expect (public, >=1 each, 390 and 1280), and on the r7 Getting-there and emergency role=group surfaces on plan-your-visit in both modes.

Pale variant (Codi): the .on-pale surface is --gold-100, rgb(251, 250, 240). plan-your-visit Getting-there is default gold; its emergency group is pale. Hub /national-show: every disclosure present is gold, or gold-100 if marked .on-pale / [data-tone="pale"]. The surface element itself is measured, never an ancestor walk from the chip.
