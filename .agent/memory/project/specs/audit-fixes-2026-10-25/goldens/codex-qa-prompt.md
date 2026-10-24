# Codex QA prompt (used as the codex_qa assertion target)

Adversarially review `git diff origin/main...HEAD` on branch fix/audit-2026-10-25 against the six goldens
in .agent/memory/project/specs/audit-fixes-2026-10-25/goldens/. Cite file:line for every finding, report
only real defects, and give a PASS or FAIL verdict. Probe specifically:

1. "biennial" replaced by "triennial" only; no other sentence reworded; no other cadence word added.
2. NosHero `titleAs="p"`: does every CSS rule keyed to `h1.nos-hero-title` still match? Does any test, e2e
   spec or a11y check (grep tests/, e2e/, scripts/checks/) assert an h1 inside a loading fallback? Does the
   hub hero (`titleSize="display"`) or any other NosHero caller change behavior?
3. NOS 404: is the fix at the actual cause, with SSR HTML carrying lang, 404 status and one h1, and the NOS
   (not SAOC) copy for /national-show/* misses? Typographic NosHero per G6 (NOS black, serif h1 at 300, no
   photo, existing strings only, unified header), also for the group-level not-found? Was any not-found file
   or the [...slug] route deleted?
4. Sitemap: ticket slugs only from the listed cards; slug validation; duplicates; `/contact` canonical is
   the NOS host; /privacy /terms /refunds absent for the stated reason; SAOC sitemap unchanged.
5. Images: the five hero photos and their crops unchanged; NO dimension cut: served real pixel width >=
   min(box x DPR, native) at 2056@2, 1440@2, 1280@2, 390@3; bytes cut by quality 75-82 and per-width
   candidates only; every srcset candidate resolves to an existing file within the golden's ceilings; no call
   site passes a quality or width the loader no longer serves; check-f-config.mjs and hero-render-check.mjs
   were adjusted, not deleted or neutered; the five committed bloom-crop PNGs are real crops of the served
   files (look at them for banding or blocking).
6. Fonts: only the two `preload: false` additions; no flash-of-wrong-font regression from losing the Lora
   preload (adjustFontFallback intact).
7. Origins: lazy evaluation (no module-scope call that throws at build in production without env); organizer
   url stays the SAOC origin on NOS pages; no robots/noindex/SITE_PUBLIC_LAUNCH/banner change anywhere.
8. Newsletter focus: the footer email input shows a visible ring with the existing outline tokens; no
   `outline-none` left on it; no new style invented; the NOS footer input untouched.
9. Scope: any file outside the allow-list in contracts/checks/audit-fixes-2026-10-25/check-scope.mjs.
