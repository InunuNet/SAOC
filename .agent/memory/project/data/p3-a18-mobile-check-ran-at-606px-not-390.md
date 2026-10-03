# p3-a18-mobile-check-ran-at-606px-not-390

**[P3] A18 mobile check ran at 606px (Chrome floor), not 390px** (menu-system-layout4,
2026-10-03). Claude-in-Chrome's resize floors at 606×667, so true 390px couldn't be reached
for the deployed-site screenshot check — see `.claude/rules/shell-paths.md`, which now bans
Claude-in-Chrome in this project for exactly this reason (use headless Playwright instead).
390px overflow IS covered in the gate by `e2e/no-horizontal-overflow-drawer-open.spec.ts`,
but no deployed-site 390px screenshot exists to visually confirm it.
