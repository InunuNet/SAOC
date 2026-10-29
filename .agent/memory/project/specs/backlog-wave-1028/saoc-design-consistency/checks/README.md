# saoc-design-consistency checks

Run every script from the project root (they read repo-relative paths): `node .agent/memory/project/specs/backlog-wave-1028/saoc-design-consistency/checks/<script>.mjs`.

## Where the site comes from
1. `DC_BASE_URL` set: the checks use that origin. Beta credentials come from `BETA_BASIC_AUTH_USER`/`BETA_BASIC_AUTH_PASSWORD` in the environment and are never printed (`node --env-file-if-exists=.env.local`).
2. `DC_PROD=1`, no `DC_BASE_URL`: lib.mjs runs `node scripts/generate-image-variants.mjs` then `next build` (when `.next/BUILD_ID` is missing) and `next start` on a free port as `http://saoc.localhost:<port>` with the recipe below, then stops exactly that process.
3. Neither: `next dev` on a free port, fixture replay, beta wall off (Home and /events do not render; Home-only checks are skipped, never faked).

## Recipe: Home (/) locally, production build
```
SANITY_FIXTURE_MODE=replay SANITY_FIXTURE_DIR=.agent/memory/project/specs/nos-content-standard/fixtures/sanity \
BETA_PASSWORD_WALL_OFF=true BETA_BASIC_AUTH_USER= BETA_BASIC_AUTH_PASSWORD= \
NEXT_PUBLIC_SAOC_SITE_URL=http://localhost NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost \
  node scripts/generate-image-variants.mjs && node node_modules/next/dist/bin/next build   # (or `pnpm build`; a bare next build leaves public/images/_opt empty and the hero 404s) then: ... next start --port <port>
DC_BASE_URL=http://saoc.localhost:<port> node .../checks/<script>.mjs
```
The two site origins MUST differ. An origin whose host is `saoc.localhost` is treated as a production build with Home enabled (`deployed` and `prod` in lib.mjs's callback). `/events` needs live Sanity and is deployed-only.

## Lighthouse
`lib-lcp-lighthouse.mjs` runs `pnpm dlx lighthouse@12.8.2` (mobile preset: simulated Slow 4G, 4x CPU, 412 px wide) and prints LCP and FCP. Its scratch lives under `.tmp/sandbox/sdc-lh/`. The desktop preset is 1350 px wide, so any assertion made at 1440 must set the width explicitly.

## Other notes
- The ten F1e routes: `/ /about /societies /judging /events /sponsors /members /contact /privacy /terms` (`tenRoutes` in lib.mjs drops Home when it cannot render and /events unless live).
- lib-woff2.mjs reads a WOFF2 cmap (Brotli + table directory); no font library is needed.
- check-critical-css-identical.mjs is the optional lever 3 assertion: it skips (passes) unless `next.config.ts` enables `inlineCss`.
- `DC_SHOT_DIR` makes check-hero-heights-report.mjs write /about@1024.png when that fallback case applies.
