# Golden: hero image weight (audit P2-11), with NOS Design's guards (final)

Governing rule: docs/rules/no-invention.md. Same photographs, same crop, same art direction. No change to
components/nos/hero-photos.ts, lib/data/heroImages.ts or any hero component.

## NOS Design guard, quoted (final)
"3-5 MB hero images: cut bytes through format and quality (AVIF/WebP, about q75-82, per-width srcset
candidates). Never cut dimensions below the bar. Served width >= box x DPR at 2056@2, 1440@2, 1280@2 and
390@3 stays the gate (Brad P0), no exceptions. Re-run the served-width probe, plus one 1:1 crop of the bloom
at 2056@2 per changed hero, so I can check for banding or blocking."

This replaces my first idea of capping at 2560 px, which would have broken the gate (2056@2 needs 4112 px).
The architect's earlier audit target of 0.3-0.4 MB is also not reachable at 4112 px; the budgets below are
what quality 75-82 actually gives.

## Baseline (q88 set built by scripts/generate-image-variants.mjs, public/images/_opt is gitignored build output)

| source | 1920 | 2048 | large variants (MB) |
|---|---|---|---|
| orchid-dark | 0.27 | 0.31 | 4096: 1.27, 5120: 1.87, 5184: 1.82 |
| orchid-pink | 0.40 | 0.45 | 3456: 1.02 |
| orchid-violet | 0.18 | 0.20 | 4096: 0.68, 5120: 1.04, 6144: 1.39, 7327: 1.83 |
| orchid-purple | 0.39 | 0.48 | 4096: 3.04, 5120: 4.67, 5308: 4.73 |
| orchid-yellow | 0.12 | 0.14 | 3100: 0.19 |

Measured candidates at 4112 px (the 2056@2 bar), whole image: purple webp q75 1.46 MB, q80 1.98 MB, avif q55
1.10 MB; dark webp q75 0.61 MB; violet 0.26 MB; pink (3456 native) 0.41 MB. So WebP q75-80 suffices; AVIF is
allowed but not needed (and would need the loader to return an .avif URL for those widths).

## Required result
Mechanism (dev's call within these limits): re-encode the above-2048 variants at WebP quality 75-82 and give
the srcset candidates that serve the four viewports, so a smaller screen does not download the 2056@2 file.
Suggested: deviceSizes `[640, 750, 828, 1080, 1200, 1920, 2048, 2560, 2880, 4112]` (4112 = 2056 x 2 exactly,
so no 5120/6144 candidate and no native-width entries above it), and keep the loader's `-q88` file naming so
call sites with `quality={88}` need no change. A source never upscales; pink (3456) and yellow (3100) top out
at their native width.

Enforced by `check-hero-bytes.mts` after the generator runs:
- `budget`: every deviceSize candidate exists and is <= 2 MiB; the file served at 2056@2 <= 2 MiB, 1440@2
  <= 1.2 MiB, 1280@2 <= 1.0 MiB, 390@3 <= 0.2 MiB; the generator never encodes below quality 75.
- `viewports`: the file served at each of the four viewports is, read from the file's real pixels, at least
  min(viewport x DPR, native width) wide. Baseline already passes this; it must keep passing.
- `bloom-crops.mts check`: for each of the five heroes an 800x800 1:1 crop at 2056@2, centred on the
  photograph's focal point (hero-photos.ts objectPosition), is committed under
  `.agent/memory/project/specs/audit-fixes-2026-10-25/artifacts/bloom-crops/<name>-2056x2.png`. The dev
  generates them with `pnpm exec tsx contracts/checks/audit-fixes-2026-10-25/bloom-crops.mts write` after the
  generator, and they must equal a fresh crop of what is served (stale artifacts fail). PSNR against the same
  crop at the old q88 must be >= 32 dB. The lead hands the five PNGs to NOS Design for the banding review.

Collateral: contracts/checks/launch-weekend/f5/check-f-config.mjs line 15 pins deviceSizes above 2048 to
4096/5120/6144 and scripts/checks/hero-render-check.mjs reads hero-source-widths.json. Update both to the new
widths (do not weaken or delete them) and docs/image-delivery.md. That f5 check was already red at baseline for
an unrelated canonical-link reason, so it is not a gate assertion here.
