# p2-focus-ring-fails-the-3-1-non-text-con

**[P2] Focus ring fails the 3:1 non-text contrast floor on two vendor forms** (measured
  2026-09-08 by the NOS session, branch `nos-design`, composited-pixel measurement via Playwright
  + pngjs — NOT a `getComputedStyle()` regex, which returns plausible wrong numbers because
  Tailwind v4 serialises opacity-modified colours as `oklab()`, see InunuNet/SAOC#3).
  Three text inputs paint focus as a two-layer `box-shadow` instead of an `outline`: an inner
  pale-gold ring that is invisible on the pale-gold ground (acting only as a spacer), and an outer
  royal-purple `#211a57` at 40% alpha. Composited that is `0.4×(33,26,87) + 0.6×(251,250,240) =
  (164,160,179)`, measured `#a3a0b3` — **2.43:1 against a 3:1 floor**. Size and position are
  correct; the alpha is what sinks it.
  Affected: `/national-show/vendors/apply` (`businessName`, `tradingName`) at 390 and 1280;
  `/national-show/vendors/register` (`code-entry-business-name`) at 1280.
  Useful adjacent signal: `/national-show/tickets`' "Get visitor tickets" anchor uses a real
  `outline: 2px solid rgb(126, 63, 151)` and passes cleanly — so TWO different focus mechanisms
  coexist across these surfaces. Likely predates the NOS restyle. Whatever the alpha ruling is,
  the split itself is worth resolving. Pending a Codi ruling; the fix is ours, not the NOS
  session's.
  NOT THE SAME AS `CategoryTicketsPage` — measured separately 2026-09-08 and it PASSES:
  composited lede contrast 11.44:1 (/national-show/workshops @390), 10.29:1 (@1280),
  7.37:1 (/national-show/conferences @1280), against a 4.5:1 floor at 17px. The 'olive body
  text on purple' concern did NOT reproduce — hue recovered geometrically (pale-gold fit
  off-line 0.4-0.5 vs olive fit 254-300), so it is pale gold at ~0.85 alpha. Do not
  re-investigate. Caveat carried: that lede buys its appearance partly with opacity, which is
  acceptable for decorative text but is the same mechanism ruled out for functional/focus
  states. Cite the r6-probe.mjs run, never r6-verify.mjs — the latter regex-parses
  getComputedStyle() and its numbers for this component are wrong.
