# Golden: hero image weight (audit P2-11)

Governing rule: docs/rules/no-invention.md. Same photographs, same crop, same art direction. No change to
components/nos/hero-photos.ts, lib/data/heroImages.ts or any hero component.

Baseline, measured by running `node scripts/generate-image-variants.mjs` in this worktree (variants are
build output in public/images/_opt, gitignored, so the pipeline is the fix, not committed files). q88 set:

| source | 1920 | 2048 | large variants (MB) |
|---|---|---|---|
| orchid-dark | 0.27 | 0.31 | 4096: 1.27, 5120: 1.87, 5184: 1.82 |
| orchid-pink | 0.40 | 0.45 | 3456: 1.02 |
| orchid-violet | 0.18 | 0.20 | 4096: 0.68, 5120: 1.04, 6144: 1.39, 7327: 1.83 |
| orchid-purple | 0.39 | 0.48 | 4096: 3.04, 5120: 4.67, 5308: 4.73 |
| orchid-yellow | 0.12 | 0.14 | 3100: 0.19 |

Cause: lib/image-widths.json lists 4096/5120/6144 and lib/hero-source-widths.json adds each photo's native
width, all served at q88 (rHB, so a 2x display is not stretched).

Required result (enforced by check-hero-bytes.mts, which resolves srcset candidates through the real loader):
- No served hero variant wider than 2560 px.
- No served hero variant above 512 KiB (0.5 MB).
- Every variant the loader can return exists after the generator runs.
Suggested route, dev may choose another that meets the numbers: cap hero widths at 2560 (replace
4096/5120/6144 and the native-width entries with 2560), and encode the above-2048 variants at a lower sharp
quality (start near 70, tune until the heaviest, orchid-purple, is under budget). Keep the 1920 and 2048
q88 files byte-identical in intent (they already sit at 0.12-0.48 MB). Keep the loader's `-q88` file naming
so call sites with `quality={88}` need no change.

Collateral the dev must update, not weaken: contracts/checks/launch-weekend/f5/check-f-config.mjs line 15
(pins deviceSizes to 4096/5120/6144) and scripts/checks/hero-render-check.mjs (reads hero-source-widths),
and docs/image-delivery.md. Change them to the new cap and say so in the commit message.
