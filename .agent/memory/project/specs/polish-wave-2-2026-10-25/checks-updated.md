# Pre-existing checks edited (supersession)

- .agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml (F6a): assertion A7's command had `$p` inside a double-quoted sed script, which the shell
  expands to nothing, so the assertion could never fail. The sed script is now single-quoted. Same intent (the prerendered /national-show page must not reach
  firebase-admin), same target string; contracts/checks/polish-wave-2-2026-10-25/f6-a7-nonvacuous.py proves the filter stage now keeps a VIOLATIONS line.
- contracts/checks/polish-wave-2-2026-10-25/f3-layout-rendered.mjs: the hub link regex now allows a query string (/tickets/vip?quantity=1), and each page waits (networkidle, then a non-empty h1, two crumb links and [data-ticket-body]) so it never measures the loading.tsx shell. Assertions unchanged.
- contracts/checks/polish-wave-2-2026-10-25/f8-kit-rendered.mjs: the #mark-only-plum deep-link assertion waits (waitForFunction, 15s) for hydration to check the Plum radio instead of reading the DOM at load. Assertions, including the 9000px height, unchanged.
