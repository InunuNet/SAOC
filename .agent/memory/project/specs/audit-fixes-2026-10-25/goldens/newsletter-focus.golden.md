# Golden: SAOC footer newsletter input focus ring (post-deploy finding, WCAG 2.4.7)

Governing rule: docs/rules/no-invention.md (no invented style, existing token only).

Finding (post-deploy run on beta): the SAOC footer email input shows `outline: none` and `box-shadow: none`
on keyboard focus, so nothing marks it as focused. Cause, components/chrome/Footer.tsx:117, the
`inputClassName` passed to NewsletterSignup: `focus:outline-none focus:border-ivory/40`. The border change
(ivory 20% to 40% on the dark footer) is far under the 3:1 non-text contrast a focus indicator needs.

NOS Design rule (final): "A field keeps a visible ring or focus-within border."

Required result: replace `focus:outline-none focus:border-ivory/40` with the ring this same component already
gives its checkbox (NewsletterSignup.tsx:149) and the footer links give on dark: 
`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ivory`. Nothing else in the
class string changes. No new colour, width or token. The NOS footer input already has its ring
(nos-chrome.css:159) and is not touched. NewsletterSignup.tsx itself needs no change unless the dev prefers
to move the class there; it is in scope either way.

Enforced by check-newsletter-focus.mjs (no `outline-none`, the three tokens present, reference ring unchanged).
The QA browser pass should Tab to the field on beta and confirm the ring paints against the footer ground.
