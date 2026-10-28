# F1e measurements (2026-10-28)

Baselines: main = origin/main 48d74378, F1d = feat/sdc-f1d-lcp b105bf09. Each was installed, `next build` and served with `next start` from its own worktree using the README recipe (fixture replay, beta wall off, SAOC origin `http://localhost`, NOS origin `http://nos.localhost`), reached as `http://saoc.localhost:<port>`. Lighthouse 12.8.2 mobile preset (simulated Slow 4G, 4x CPU) via checks/lib-lcp-lighthouse.mjs. Scripts: checks/.

## Lighthouse, local production build

| build | / LCP | / FCP | / gap | /about LCP | /about FCP | /about gap |
|---|---|---|---|---|---|---|
| main | 3988 (run 1), 4512 (run 2) | 1659 | 2329 to 2853 | 4215 (run 1), 4730 (run 2) | 2257 | 1958 to 2473 |
| F1d b105bf09 | 4372, 4588 | 1663 | 2709 to 2930 | 4362, 4362 | 2259 | 2103 |

Run-to-run spread is about 500 ms locally. Local numbers are more pessimistic than beta (beta main: / 3262, /about 2426), so the local production gate is the harder one. The 2500 ms target needs roughly 1.9 s removed from /about at the local profile.

## Fonts (production build, /about and the nine other routes, 390 and 1440, cold cache)
- Every route requests CrimsonPro_latin_normal, CrimsonPro_latin_italic and Manrope_latin_normal TWICE and loads 5 distinct files (adds JetBrainsMono and Lora). Gate: no duplicate, <=3 files.
- app/layout.tsx declares each Crimson Pro file 4 times (300/400/500/600, normal and italic), Manrope 4 times, JetBrains Mono twice. Files are 48,152 (Crimson normal), 51,376 (Crimson italic) bytes.
- The built CSS also carries Lora, Fraunces and Karla faces (NOS fonts) on SAOC pages; Lora is actually requested on /about. Karla and Fraunces are declared twice.
- No `<link rel=preload as=font>` at all in the server HTML (0 font preloads). The hero image preload already precedes the three stylesheets (offsets 1596 vs 2851), so only the font half of A7 is red.
- Glyphs, from the shipped files' cmaps (checks/lib-woff2.mjs): U+0149 (n-apostrophe) is MISSING from every shipped file, so Afrikaans text falls back to a system face today. All the other ruled glyphs are present. The walk also finds U+2192 (arrow) missing from Crimson Pro, Manrope and JetBrains Mono on Home, Societies and Judging ("Full calendar ->", "Contact SAOC ->") and U+203B missing from Manrope on Home. The dev either adds those code points to the subset or draws the arrows as SVG; the check only requires that nothing falls back.
- Font swap: font-display swap everywhere with a metric-matched `<family> Fallback` face (size-adjust). CLS with fonts delayed 1500 ms: 0.0022 /@390, 0.0104 /about@390, 0.0040 /@1440, 0.0026 /about@1440 (<0.02 already; guard).
- Font-file bytes are not a gate; the gate is files and requests.

## Favicon
- Served today: /favicon.ico 90,388 bytes + icon.png 193,840 + apple-icon.png 19,309. Icon links total 277.6 KB.
- Source, identified by the architect (the NOS Design text does not name the file): goldens/favicon-source/emblem-512.png, an exact copy of app/icon.png at origin/main (git blob in goldens/favicon-source.json), committed in d42f6cc0 as the council-approved SA Orchid Council emblem favicon. The alternative candidate is branding/SA Orchid Council/emblem/Eulophia-speciosa-emblem.png (1254 px, untracked, Brad's active workstream, read-only). NOS Design to confirm which is "the supplied emblem file"; changing it is a one-line edit to favicon-source.json plus a copy.
- Review renders (Lanczos, palette PNG): goldens/favicon-renders/favicon-16.png (505 B), favicon-32.png (1,284 B), favicon-48.png (2,179 B), favicon-180.png (11,438 B), and favicon-review-sheet.png (1:1 above, 8x nearest-neighbour magnification below, 180 at 2x). 32 + 48 PNG total 3.5 KB, well inside 10 KB. NOS Design must see the sheet before merge. The emblem is wider than tall, so a contain fit leaves empty bands; trimming to the artwork (allowed, not a redraw) fills more of the tab icon.
- The derivation test (check-favicon.mjs emblemDistance) flattens, trims to the artwork, fits 64x64 and compares RGB: the renders score 0.5 (180), 7.0 (32), 11.5 (16); main's apple-icon.png 4.5; an unrelated photo 71.2. Bound 20.

## Hero
- F1d hero 750w AVIF = 17,738 bytes (/about, orchid-violet-about). Bound 25,000.

## Accepted limitations of the F1e checks (Codex A15 findings)
Fixed in the checks: (a) check-font-fallback-walk.mjs now also walks every visible input/textarea placeholder, resolved through its ::placeholder style; (b) check-fonts-network.mjs detects duplicate fonts by FILE (sha256 of the response body), not by URL, and counts distinct files the same way.
Accepted, not closed:
- (c) check-preload-order.mjs proves the ORDER OF TAGS in the server HTML head, not the order of network requests. Reason: a browser's request order is a scheduling outcome that headless fixtures cannot reproduce faithfully. The outcome check is the phase-5 LCP gate (A11, median of 3 runs, LCP <= 2.5s on beta).
- (d) check-favicon.mjs's mean difference <= 20/255 shows LIKENESS to the supplied emblem, not derivation. Reason: pixel comparison cannot prove how a file was made. Provenance is held by goldens/favicon-source.json (path + sha256, CONFIRMED app/icon.png) and the build path that derives every icon from app/icon.png; the crop and opacity rules are asserted separately by check-favicon-crop.mjs.
Arrow guard A29: the ruled back arrow (svg[data-direction="back"], "All societies") on the society page is classified separately from the F1d baseline links, expected on /societies/[first] only (>=1, label "All societies", never wraps), unexpected anywhere else; its pixel position has no F1d baseline (it was a text glyph outside the baseline), so only its structure is asserted.
