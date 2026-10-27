# F2 golden: Lee-Ann SAOC copy fixes (source: .tmp/sandbox/leeann-1025/audit-report.md sections 17-18)

Rule: remove or rename only. No replacement wording is written (docs/rules/no-invention.md).

## (a) Constitution becomes "Memorandum of Incorporation" (her WhatsApp, 24 Oct)
- Page moves to app/(marketing)/memorandum-of-incorporation/page.tsx. metadata title "Memorandum of Incorporation"; description must not say "Constitution" (architect-suggested neutral: "The Memorandum of Incorporation of the South African Orchid Council."); path '/memorandum-of-incorporation'; PageHero heading "Memorandum of Incorporation". Hero eyebrow "Governance" is an invented pill: keep or drop is the F1 standard's call (hero pills are approved anatomy); F2 does not touch it.
- Body: content/legal/constitution.ts is untouched (verbatim to her doc).
- Footer labels: components/chrome/footer-data.ts:61 and components/nos-chrome/NosFooter.tsx:171 (href saocUrl('/memorandum-of-incorporation')). nos-footer-data.ts:7 comment may keep the word in prose.
- Sitemap: lib/saoc-sitemap-routes.ts replaces '/constitution' with '/memorandum-of-incorporation'.
- proxy.ts: routeSaocHost 308-redirects '/constitution' (query preserved) to saocUrl('/memorandum-of-incorporation'), same redirectTo() helper as the retired sa-exhibitors paths. routeNosHost: '/constitution' and the new path are SAOC-only and go to the SAOC origin in ONE hop straight to the new path (no chain). SAOC_ONLY_EXACT gains the new path.
- Expected probe results (SAOC host saoc.example / NOS host nos.saoc.example):
  - saoc.example/constitution          -> 308 https://saoc.example/memorandum-of-incorporation
  - saoc.example/constitution?a=1      -> 308 https://saoc.example/memorandum-of-incorporation?a=1
  - saoc.example/memorandum-of-incorporation -> served (no 3xx)
  - nos.saoc.example/constitution      -> 308 https://saoc.example/memorandum-of-incorporation
  - nos.saoc.example/memorandum-of-incorporation -> 308 https://saoc.example/memorandum-of-incorporation
- Out of scope, flag to @dev: public/llms*.txt mention the old route if present; regenerate via the repo's own script, do not hand-edit.

## (b) Society copy that is not hers
- Delete components/societies/SocietyExpect.tsx, its export in components/societies/index.ts and its use at app/(marketing)/societies/[slug]/page.tsx:144.
- societies/page.tsx: delete UNSOURCED_LEDE and its render block (lines ~34-35, 119-123); no lede, no computed count. If the PageHero handoff requires a lede, F1 decides; F2 renders none.
- SocietyAbout.tsx: delete the generic fallback block (`!society.description && !withhold`), the unused `region` variable and the file-header comment that describes it. Section returns null when there is no description and no links (guard no longer depends on `withhold`; the `withhold` prop is removed with its callers).
- KEEP SocietyDetailsCallout (sanctioned flag that copy is awaited).

## (c) Figures out
- components/home/MissionBlock.tsx:59 fallback paragraph: remove the sentence fragment "a federated network of 21 societies" and, because the figure goes, the whole unsourced fallback paragraph (its other claims, "first standardised in 1990" and the annual publication, are likewise not in her Drive). No replacement text. The "in cultivation" paragraph stays.
- Same figure, one more place (flagged to lead; delete assertion A-F2-12 if not wanted): app/(marketing)/societies/[slug]/page.tsx:162 CTASection body "SAOC coordinates 21 affiliated societies...". Remove the body prop value (CTASection already accepts undefined).

## Notes for @dev (F1 and F2)
- Run `pnpm install --frozen-lockfile` in the worktree before the gate. A-F2-07 (redirect probe, needs node_modules/.bin/tsx) and every A-F1 runtime check (Playwright, next dev) need it. A symlinked node_modules breaks Turbopack; do a real install. The runtime checks also need `.env.local` in the worktree root (Sanity read), copied from the main checkout.
- Decisions (lead, 2026-10-25): A-F2-13 stays; the whole MissionBlock fallback paragraph is removed; the neutral meta description is accepted.
- Do not commit AGENTS.md if it shows as modified.
