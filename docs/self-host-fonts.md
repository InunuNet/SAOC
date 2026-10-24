# Self-hosted fonts

Every font on the site is served from files vendored in the repo and loaded with
`next/font/local`. The build never contacts Google. This replaced six `next/font/google`
families after the CI build failed repeatedly with `module-not-found` when the Google Fonts
fetch flaked.

Technical change only: no font, weight, subset or visual change (see
[`rules/no-invention.md`](rules/no-invention.md)).

## Files

All files live in `app/fonts/<family>/`, with the family's `OFL.txt` beside them. Each is the
`latin` subset only, which is the only subset the original calls requested.

| Family | Files | Weights / styles | Used by |
|--------|-------|------------------|---------|
| Crimson Pro | `CrimsonPro-latin-normal.woff2`, `CrimsonPro-latin-italic.woff2` | 300 400 500 600, normal + italic | `app/layout.tsx` (`--font-serif-loaded`) |
| Manrope | `Manrope-latin-normal.woff2` | 400 500 600 700 | `app/layout.tsx` (`--font-sans-loaded`) |
| JetBrains Mono | `JetBrainsMono-latin-normal.woff2` | 400 500 | `app/layout.tsx` (`--font-mono-loaded`) |
| Karla | `Karla-latin-normal.woff2` | 400 500 600 700 | `components/nos-chrome/fonts.ts`, `components/nos/NosThemeScope.tsx` (`--font-nos-karla`, no preload) |
| Fraunces | `Fraunces-latin-normal.woff2`, `Fraunces-latin-italic.woff2` | variable `100 900` (opsz axis), normal + italic | same two files (`--font-nos-fraunces`, no preload) |
| Lora | `Lora-latin-normal.woff2` | 500 | `components/chrome/SaocLockup.tsx` |

Fallback metrics are set with `adjustFontFallback`: `Times New Roman` for Crimson Pro,
Fraunces and Lora; `Arial` for Manrope, Karla and JetBrains Mono (the fallbacks the Google
pipeline chose before). `next/font/local` has no `unicode-range` splitting, so the Latin
Extended and Vietnamese files Google also listed are not vendored. The original builds never
fetched them for any page.

## Licence

Every family is licensed under the SIL Open Font License, Version 1.1 (OFL). The licence text
and copyright line for each family are in `app/fonts/<family>/OFL.txt`; the OFL permits
bundling and redistribution with the site. Keep each `OFL.txt` beside its font files.

## How to refresh a font file

1. In a throwaway worktree, temporarily switch the family back to `next/font/google` with the
   same options and run `pnpm build` with network access.
2. In `.next/static/chunks/*.css`, find the `@font-face` for the family whose `unicode-range`
   begins `U+??,U+131` (the Latin block). Its `src:url(../media/<hash>.woff2)` names the file
   in `.next/static/media/`.
3. Copy that file over the matching name in `app/fonts/<family>/`, confirm it begins with the
   `wOF2` magic bytes, and refresh `OFL.txt` from
   `https://raw.githubusercontent.com/google/fonts/main/ofl/<family>/OFL.txt`.
4. Run `pnpm build`; the loaded-file hashes in the browser should change only for the family
   you refreshed.

## Offline build proof

The build must succeed with the Google font hosts unreachable. The mission check
`checks/offline-build-check.sh` (spec `self-host-fonts`) builds with an empty
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, blocks the font hosts at the Node level, and then scans
`.next` for any mention of `fonts.googleapis.com` or `fonts.gstatic.com`.

Known leftover: the retry in `scripts/ci-e2e.sh` existed only for the `next/font/google`
flake and is now dead code. It is left in place deliberately; removing it is a separate
change.
