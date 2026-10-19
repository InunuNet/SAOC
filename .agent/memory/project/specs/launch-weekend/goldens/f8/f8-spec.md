# launch-weekend F8 - no AI placeholder prose in public (R51, P0) - implementation spec for @dev

Base: `origin/main`. Rules: docs/rules/no-invention.md ("a gap is named, never filled"; Lee-Ann's Drive under
`content/drive-source/` is the only source of copy), design/design_handoff_saoc/ + branding/ (visual decisions; none
change here), contracts/golden/show-visitor-info/confirmation-status-model.golden.md:15,28 (`pending` = "We made it up as
scaffolding", seeded pendingLabel "To be confirmed by the show committee"), national-show-ia-alignment M4 goldens
(r11-disclosure, never-404-fallback). Run: lead sets the base ref; the gate runs with cwd = the implementation tree.

## What is wrong (measured on origin/main, dev server, 2026-10-16)
Six routes render `ShowPageProse` sections whose notice is the "Placeholder copy / This text is an AI-generated
placeholder..." frame. Sections (captured in goldens/f8/placeholder-sections.json): programme 2, symposium 2 (+1 preserved
council `theme`), wosa-conference 3, international-guests 2, sponsors 1, sa-exhibitors 1 (+1 preserved `overview`).
The frame is a disclaimer standing in for content, which no-invention.md forbids. The cause is in two places in
`lib/data/show-pages.ts`: `classifySection()` returns class `placeholder` for `placeholder-ai` AND for every unverifiable
claim (null/unknown provenance, `council-*` that fails source linkage, non-prose kinds), and `buildAbsentShowPage()` builds its
fallback with the same warning notice. The other 11 routes are clean today (measured).

## Decision: (a) unconditional, with one opt-in preview switch (default = withhold everywhere, beta included)
Recommended default is (a). Reasons: (1) beta is where Lee-Ann and the E2E runs look, and the rule is about what the site
asserts, not who sees it; (2) the prose is agent-written and she cannot approve it, her Drive docs outrank it; (3) with (b)
the production behaviour could only be proven by flipping SITE_PUBLIC_LAUNCH, i.e. never before launch; (4) fewer states.
The AI prose is NOT deleted (Sanity and content/show-pages/*.json untouched), so this is fully reversible.
The single switch for the lead is `SHOW_PLACEHOLDER_PREVIEW=true`. It re-enables the labelled placeholders ONLY while the
wall is up: `withholdPlaceholderProse(env)` returns `!(env.SHOW_PLACEHOLDER_PREVIEW === 'true' && !isPubliclyLaunched(env.SITE_PUBLIC_LAUNCH))`.
So a mistaken value on production cannot expose prose (SITE_PUBLIC_LAUNCH=true forces withhold), and the match is exact,
fail-closed, like lib/beta-public-launch.ts. Setting it on beta is an apphosting.yaml (production config) edit and is the
lead's call, outside F8. Do not add it to apphosting.yaml in this feature.
Note: pages with `revalidate = 60` read env at render; only the opt-in preview depends on that, the default does not.

## 1. Data layer - `lib/data/show-pages.ts` (the only logic file)
- `export function withholdPlaceholderProse(env: {SHOW_PLACEHOLDER_PREVIEW?: string; SITE_PUBLIC_LAUNCH?: string} = process.env): boolean`
  as above. These two names are the only `process.env` reads allowed in the file.
- `ShowPageNotice` gains optional `gap?: true`. The gap notice is built from EXISTING strings only:
  `{ label: 'To be confirmed by the show committee', text: ABSENT_SHOW_PAGE_FIXED_SENTENCE, tone: 'muted', gap: true }`.
  Tone `muted`, never `warning`, never `error`. Define the label once as an exported constant next to
  FALLBACK_*; it must equal the string already in sponsors/page.tsx:79. No other new string.
- `export function applyContentGaps(sections: ShowPageSection[], withhold: boolean): ShowPageSection[]`. A section is withheld
  iff its resolved `notice?.tone === 'warning'` (the placeholder class, not the provenance string: this also catches an
  unverifiable council claim, which today is labelled "AI-generated" and is unverified prose anyway). When `withhold` is
  false, or no section is withheld, return the input array contents unchanged (same objects). Otherwise replace the FIRST
  withheld section with one gap section (`heading: null`, `kind: 'prose'`, body `wrapGatedProse([], gapNotice)`, same
  `sectionKey` namespace, `notice: gapNotice`) and drop the other withheld ones. `clean`, `research` and `council-draft`
  sections are untouched and keep their order and headings (they keep their own muted notices).
- Call it from `hydratePage` (after hydrating sections) and from `buildAbsentShowPage` with `withholdPlaceholderProse()`.
  For the absent-page fallback the body keeps only the manifest `purpose` block (the fixed sentence now lives in the gap
  notice), so the sentence renders once. `pageProvenance`/`page.notice` derivation is unchanged (no consumer renders them;
  the A5 static guard on literal assignment still holds).
- Headings: a heading that exists only for AI prose is dropped with it (decision). The gap block has no h2, the hero h1 titles
  the page. No empty h2 and no run of 2-3 identical gap blocks (wosa-conference would otherwise show three).

## 2. Render layer - `components/nos/ShowPageProse.tsx` (one attribute)
Add `data-nos-content-gap` (value `true`) on the outer wrapper when `notice?.gap`. Nothing else: the chip + one sentence +
dashed rail R11 markup already renders a muted notice correctly. `ShowContentState.tsx` is NOT edited (saoc-nos-site-77 r3
owns it; the data layer makes it unnecessary). The six route pages are not edited except programme.

## 3. /programme - `app/(marketing)/national-show/programme/page.tsx`
Pass `afterProse` to `ShowContentState`: a container with `data-nos-programme-links` holding two links, to
`/national-show/symposium` (label "SAOC Symposium") and `/national-show/workshops` (label "Workshops"), labels exactly as in
`ShowSectionNav` SECTION_LINKS and `content/national-show-routes.json`. Both routes exist (git ls-files, both 200 on dev).
Reuse the `inline-link` class already used by wosa-conference's `afterProse`. Result: h1 "Programme" once, gap block, links.
DEVIATION from the brief, deliberate: do NOT reuse "once the full programme is confirmed". That sentence is the body of the
`placeholder-ai` section itself (verify-nos-content-state.ts:625 pins it as placeholder text); reusing it puts AI prose back.
The chip + `ABSENT_SHOW_PAGE_FIXED_SENTENCE` is the existing R11 honest state.

## 4. Sitemap, metadata, OG, llms
Verified clean, guarded, no change: `app/sitemap.ts` derives from content/national-show-routes.json (URLs only);
every route's metadata is a static `buildPageMetadata` string in its page file; the showPage `seoTitle/seoDescription/seoImage`
fields are not consumed anywhere outside the loader (static check enforces); `scripts/refresh-llms.ts` queries aboutPage,
homePage, society, judgingPage, societyEvent, nationalShow, show, contactPage, never `showPage`, and public/llms*.txt contain
no placeholder wording (static + runtime checks enforce). Routes stay in the sitemap (they are real, nav-linked pages).

## 5. Out of scope, flagged
- The hero `lede` on these routes comes from showPage `summary` (e.g. "The master timetable across all National Show
  activities.") which has no provenance field. It is unprovenanced agent text of the same family; F8 does not change it.
  Brad/lead decision whether a follow-up should withhold or source ledes.
- verify-nos-content-state.ts NF13 already fails on origin/main (it did not expect the "Placeholder copy" chip text). The dev
  may update that check to the gap rendering; it is not a gate assertion. verify-show-page-m1 P3 also already fails (17-faq).
- Other routes carry no showPage placeholder sections today; the generic runtime scan still covers all 17.

## Verification
`node contracts/checks/launch-weekend/f8/check-a-static.mjs`, `check-b-runtime.mjs` (BASE_URL, server with the three flags
unset), `pnpm exec tsx contracts/checks/launch-weekend/f8/check-d-gap-logic.mts`, `check-c-scope.mjs`, then lint,
type-check, build. Do not run a production build while the dev server runs.

## Amendment 1 (Codex F8 review, P1s)
- Preview switch needs the wall to be REALLY up. `lib/beta-public-launch.ts` exports `isBetaWallConfigured(user, password)` (both
  non-empty strings, exactly proxy.ts's `credentialsConfigured`); `proxy.ts` and `withholdPlaceholderProse` both use it, so the
  definition lives once. Preview un-withholds only if `SHOW_PLACEHOLDER_PREVIEW === 'true'` AND not launched AND
  `isBetaWallConfigured(BETA_BASIC_AUTH_USER, BETA_BASIC_AUTH_PASSWORD)`. Creds unset or empty (wall down) = withhold.
  The env parameter of `withholdPlaceholderProse` gains the two BETA_BASIC_AUTH_* keys.
- The absent-doc fallback keeps its manifest `purpose` block: `buildAbsentShowPage` is exported (test seam), and its single
  section must render purpose once, the gap sentence once, the chip once, no AI wording (A3 renders it with ShowPageProse).
- ShowContentState's fallback-unpublished branch renders `afterProse`, so /programme keeps its two links when the doc is absent
  (A1 static). This is the one allowed edit to that file.
