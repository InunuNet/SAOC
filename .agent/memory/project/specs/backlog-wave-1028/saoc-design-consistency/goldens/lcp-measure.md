# SA-9 LCP and hero bytes (measured 2026-10-28)

Lighthouse 12.8.2, mobile preset (simulated Slow 4G, 4x CPU), against https://beta.saoc.co.za (App Hosting, built from main at measure time), via checks/lib-lcp-lighthouse.mjs:
- `/`      LCP 3262 ms (FAIL, limit 2500). LCP element: the home hero <img> (class home-hero-img).
- `/about` LCP 2426 ms (passes by 74 ms, inside run-to-run noise). LCP element: hero <img class="object-cover">.
The 7-18 s in f2 P1 was the harsh profile; informative only per the ruling.

Markup on main (curl + DOM): no `fetchpriority` attribute on any <img>; two `<link rel=preload as=image>` on /about (header lockup and hero) both with imagesrcset and imagesizes; no `<picture>`; no AVIF anywhere (lib/image-loader.ts is WebP-only, `images.formats` is ignored with a custom loader, scripts/generate-image-variants.mjs emits WebP only). The header lockup `<Image priority>` competes with the hero.

Bytes at 1200w, sharp, source public/images/orchid-violet.jpg (7327 px): webp q88 94 KB (current hero), webp q75 49, webp q72 46, avif q55 38. Hero <=180 KB at 1200w already holds; the check guards it.
Sharpness already holds on main (check passes: served >= min(box x DPR, source cap) at 390@3 and 2056@2). It is a regression guard.

Design calls recorded (architect):
1. Exactly one fetchpriority=high image per page: the hero. The header lockup drops `priority` (default loading); it must still render.
2. AVIF-first via `<picture>`: `<source type="image/avif" srcset sizes>` first, WebP `<img srcset sizes>` fallback, same width list. Preload: one `<link rel=preload as=image type="image/avif" imagesrcset imagesizes>` identical to the AVIF source. Home: first slide only; later slides lazy, no preload.
3. Quality constants: AVIF ~55, WebP 72 for the hero set. NOS Design signs off one 390@3 and one 2056@2 crop by eye per encoder change (human step, not assertable).
4. Lighthouse needs a production-built origin, so the LCP assertion is post-deploy (phase 5), run with DC_BASE_URL.

## NOS Design confirmation (2026-10-28, relayed by team-lead)
- The header lockup drops `priority` but stays `loading="eager"` with the default fetchpriority (A9 asserts explicit loading="eager" in the server HTML, no fetchpriority).
- The hero img and its preload must be present in the SERVER HTML (A9, no JS).
- No opacity animation or transition on the hero img, its wrappers or the h1 (A10). Home's first crossfade slide wrapper currently fades via `transition-opacity duration-[1400ms]` (components/home/Hero.tsx slide wrapper); the deployed variant (A12) checks it.
- The <=2.5s Slow 4G gate stays (phase 5 A7).
