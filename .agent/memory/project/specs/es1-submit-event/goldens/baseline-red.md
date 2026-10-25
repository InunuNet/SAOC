# Baseline-red record (base 823e6b09, production build, measured 2026-10-25)

| assertion | baseline |
|---|---|
| A1 es1-static.mjs | RED, 7 findings (LoginPrompt: no PageHero, hand-written h1, gray/text-2xl/font-semibold, heading, lede, link classes; page.tsx gray-*). The P (parity) and W (payload) sections are green: regression guards |
| A2 es1-frozen.mjs | green at base by design (guard) |
| A3 f7-success-static.mjs | green at base by design (F7 guard) |
| A5 es1-rendered.mjs | RED, 12 findings, all on surface U (/events/submit unauthenticated): h1 is Manrope 600 not Crimson Pro 300, no [data-page-hero], 2 gray-* elements, CTA not equal to /contact's submit (no background, 0 padding, 19px tall), both 390@3 and 1280@1. Surface F (fixture) has 0 findings: green guard |
| A6 scope.mjs | green at base; red if any file outside scope.json is touched (self-test: --files with SubmitEventForm.tsx fails) |

The green-by-design assertions exist so the dev cannot trade the F surface for the U surface.
