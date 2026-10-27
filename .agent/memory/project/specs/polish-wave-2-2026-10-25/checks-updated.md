# Pre-existing checks edited (supersession)

- .agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml (F6a): assertion A7's command had `$p` inside a double-quoted sed script, which the shell
  expands to nothing, so the assertion could never fail. The sed script is now single-quoted. Same intent (the prerendered /national-show page must not reach
  firebase-admin), same target string; contracts/checks/polish-wave-2-2026-10-25/f6-a7-nonvacuous.py proves the filter stage now keeps a VIOLATIONS line.
- contracts/checks/polish-wave-2-2026-10-25/f3-layout-rendered.mjs: the hub link regex now allows a query string (/tickets/vip?quantity=1), and each page waits (networkidle, then a non-empty h1, two crumb links and [data-ticket-body]) so it never measures the loading.tsx shell. Assertions unchanged.
- contracts/checks/polish-wave-2-2026-10-25/f8-kit-rendered.mjs: the #mark-only-plum deep-link assertion waits (waitForFunction, 15s) for hydration to check the Plum radio instead of reading the DOM at load. Assertions, including the 9000px height, unchanged.
- contracts/checks/polish-wave-2-2026-10-25/f4-links-static.mjs and f4-links-rendered.mjs (NOS Design round 2): the policy row must precede the Buy hint, and the first link starts 12-16px under the CTA (was <=160px); the 390 form inset is now asserted.
- contracts/checks/polish-wave-2-2026-10-25/f8-kit-static.mjs and f8-kit-rendered.mjs (NOS Design round 2): merged Lockups picker assertions, height limit 10,500px (was 9,000), preview-image naturalWidth after scroll.
- contracts/checks/polish-wave-2-2026-10-25/f8-kit-static.mjs and f8-kit-rendered.mjs (NOS Design round 4): the merged section has exactly one zip link that follows the family toggle; the two-zips assertion is replaced.
- contracts/checks/polish-wave-2-2026-10-25/f8-kit-rendered.mjs (NOS Design round 5): the accessible-name resolver now follows aria-labelledby; added: family group named "Full colour · Greyscale", variant group named for the selected family in both states, the two never share a name.
