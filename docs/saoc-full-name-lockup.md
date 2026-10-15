# SAOC full-name lockup

## Instruction and source

Lee-Ann, relayed by Brad on 2026-10-15, verbatim: "use the SAOC Branding logo with the
full name South African Orchid Council". The source of truth is Brad's approved lockup
explorer, `scripts/lockup-export-harness/app.js` (never edited; see
`docs/rules/no-invention.md`).

## The W2 wordmark

`WORDMARKS` in `app.js` holds W1 `'SA Orchid Council'` (index 0, the shipped default) and
W2 `'South African Orchid Council'` (index 1). The state field `WM` is the array index, so
the change is `WM:0 -> WM:1`. Every other parameter is unchanged (palette P3 Lapis & Sun,
Lora 500, JetBrains Mono 500, tagline "Making a difference since 1968", rule on, es 140,
ns 110, tsz 140). The accessible label and alt text already used the full name.

## Header and mobile drawer: raster route

Header and drawer keep a raster, regenerated at WM:1:

- `scripts/lockup-export-harness/index.html` reads a `WM` query param.
- `scripts/export-saoc-lockup.mjs` passes `WM: 1` for both variants and honours
  `SAOC_LOCKUP_OUT_DIR` (output directory override, used by the A7 re-export check).
- Output: `public/images/saoc-lockup-horizontal-full-name.png` (3757x493, aspect 7.62).

The file has a new name because replacing `saoc-lockup-horizontal.png` at the same URL would
be served stale by the next/image optimiser cache and the App Hosting CDN. The old PNG is
deleted. The exporter also writes `saoc-lockup-vertical-dark.png`; it is unreferenced and not
committed.

The header does not use the live `SaocLockup`: that version previously widened the logo zone
enough to wrap the primary nav, and W2 is about 1.6x wider again.

## Display tiers (width; height follows the true aspect via `h-auto`)

| Surface | Width |
|---|---|
| Header below 640px | 190px (link is `min-w-0 shrink`, `max-w-full`) |
| Header 640-1239px | 460px |
| Header 1240-1279px | 340px |
| Header 1280px and up | 380px |
| Mobile drawer | 210px |

The 340px tier exists because 380px at 1240px wrapped "Judging & Awards" and "National
Show". `sm:max-[1239px]:` is used because a plain `sm:` class overrode the `min-[1240px]:`
one in the generated CSS.

## Footer: container-query sizing

Only `WORDMARK` changed in `components/chrome/SaocLockup.tsx`, plus a fit-to-column rule.
The artifact does this with `data-fit` (zoom = min(1, parentWidth / contentWidth)). The
vertical link is a size container (`[container-type:inline-size]`, `w-full min-w-0`) and the
wordmark font-size is `min(30px, 7cqw)`. Emblem, rule and tagline stay literal.

## Exporter dependency on an untracked emblem

The exporter reads `branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png`. At the
time of this change that file was untracked in the main tree (the base commit only has the
`Eulophia-speciosa r1-r4.png` files). Re-running the exporter from a clean checkout fails
until that file is present. `branding/` is read-only; do not commit it from this feature.

## Pre-existing ShowBand overflow at 768px

`components/home/ShowBand.tsx` overflows the viewport by about 1px at 768px (right edge
769.03), present at base f5622860 and unrelated to the lockup. Check A8
(`contracts/checks/saoc-full-name-lockup/check-fit.mjs`) reports it as a WARN, not a failure.

## Checks

`contracts/checks/saoc-full-name-lockup/`: A1-A3 `check-wordmark-source.sh`, A4
`check-raster-and-wiring.mjs`, A7 `check-reexport-matches.mjs` (needs network for web fonts),
A8 `check-fit.mjs` (needs `pnpm build && pnpm start -p 3002`; set `SITE_PUBLIC_LAUNCH=true`
locally or the beta wall returns 401).
