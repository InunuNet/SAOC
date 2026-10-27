# Golden: preloaded fonts (audit P2-12)

Governing rule: docs/rules/no-invention.md. No family, file, weight or fallback changes.

Baseline: home preloads five woff2 files: Crimson Pro normal, Crimson Pro italic, JetBrains Mono, Lora,
Manrope (confirmed in .tmp/sandbox/audit/{saoc,nos}/home.html). Next preloads every file of a localFont
unless `preload: false`.

First paint needs the heading serif and the body sans, so Crimson Pro (normal + italic share one
declaration and cannot be split without changing families) and Manrope keep preloading. JetBrains Mono
(mono labels, below the fold) and Lora (SAOC lockup wordmark, fallback-metric matched through
`adjustFontFallback`) load on first use.

Required result (check-fonts.mjs): `preload: false` added to `jetBrainsMono` in app/layout.tsx and `lora` in
components/chrome/SaocLockup.tsx; nothing else in those declarations changes. Preload tags only exist in production
builds (`next dev` emits none), so the built home page should show three preload links (Crimson normal,
Crimson italic, Manrope); the dev verifies that once on a `next build` + `next start` and records the count.

Known limit, not fixed here: on the NOS host the first-paint faces are Fraunces and Karla, which are
`preload: false` on purpose (components/nos-chrome/fonts.ts explains why: a preload in the shared layout
would reach every SAOC route). The NOS host therefore still preloads Crimson/Manrope that its own pages use
little. Fixing that needs host-aware preloading, a design change, so it is reported, not done.
