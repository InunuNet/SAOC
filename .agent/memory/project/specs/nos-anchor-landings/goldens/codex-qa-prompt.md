# Codex adversarial review: nos-anchor-landings

You are reviewing a CSS-only diff on the NOS Site (Next.js, Tailwind v4). Review the whole diff of branch `fix/nos-anchor-landings` against the base commit. Run in the PR worktree.

Intent (NOS Design ruling 2026-10-28, root comms.md "A13 sweep: rulings"): every NOS hash target lands 24px below whatever is pinned (nothing pinned: 24 from the viewport top).
Pinned chrome: the NOS header from 768 (rendered height 97, token `--nos-header-h`), plus the 48px doc-index bar under 1024.
Expected edits only: `components/nos-chrome/nos-chrome.css` (:root tokens `--nos-header-h: 97px`, `--nos-landing-air: 24px`), `app/globals.css` (`--doc-index-bar-h: 48px` and its single use), `app/(nos)/national-show/nos-structure.css` (the doc-variable block and the four generic hash-target rules, exactly as `goldens/expected-nos-structure-blocks.css`), `docs/nos-anchor-landings.md`.

Hunt for:
1. Any literal 97, 121, 112, 136 or 80 left in the edited rules, or a token redefined with a literal outside nos-chrome.css.
2. A breakpoint still at 780 for `--doc-index-top` / `--doc-scroll-margin`; the comment "not sticky under 780" surviving.
3. Specificity or cascade mistakes: does `.nos-theme .doc-layout--index [data-doc-main] .doc-h2[id]` (0,5,0) win in the <1024 band without leaking to >=1024? Does the globals.css `calc(var(--doc-scroll-margin) - var(--scroll-padding-top))` still cancel the html scroll-padding at >=1024, with `--scroll-padding-top` 0 and non-zero?
4. A change in computed behaviour on the SAOC host (non-NOS pages that use globals.css `.doc-aside[data-doc-aside-kind='index']`): `--doc-index-bar-h` falls back to 48px, so SAOC must compute byte-identical heights. Check `var(--doc-index-bar-h, 48px)` is used with the fallback.
5. `calc(env(safe-area-inset-top, 0px) + var(--nos-header-h))` inside a custom property: valid at computed-value time? Any case where it becomes guaranteed-invalid (landing 0)?
6. Ticketing-bar variants: 700-767 (bar only) and >=768 (bar + header). Anything that now lands wrong?
7. Files outside scope: any change to components/sponsors/*, app/(nos)/national-show/sponsors/page.tsx, components/newsletter/NewsletterSignup.tsx, app/layout.tsx, CLAUDE.md, AGENTS.md, .claude/, execution/, test-results/.
8. Overlap risk with unmerged branch feat/nos-type-tokens in nos-chrome.css (it edits `.nh-link`, `.nh-cta`, `.nh-burger`, `.nf*` rules): would the header still render 97px (+/-1) after it merges? State if you cannot tell.

Output: a verdict line `PASS` or `FAIL` first, then numbered findings with file:line and a one-line fix each. Do not rewrite the code.
