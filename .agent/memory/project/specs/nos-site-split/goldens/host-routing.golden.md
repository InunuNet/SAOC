# Golden: host routing matrix (nos-site-split) — REVISED after NOS Design rulings

Origins (env, one module `lib/site-hosts.ts`, edge-safe, pure):
- SAOC origin = NEXT_PUBLIC_SAOC_SITE_URL, else SITE_URL (runtime, server only), else dev default `http://localhost:3002`, else `https://saoc.co.za`.
- NOS origin  = NEXT_PUBLIC_NOS_SITE_URL, else dev default `http://nos.localhost:3002`, else `https://nos.saoc.co.za`. ("dev default" only when NODE_ENV !== 'production'.)
- `siteForHost(host)`: `x-forwarded-host` (first value) else `host`; strip port; lower-case. 'nos' iff hostname === hostname(NOS origin) OR starts with `nos.`; everything else is 'saoc'.
- Exports (stable API, F2/F3 code against it): `type Site`, `siteForHost(host: string|null): Site`, `saocOrigin()`, `nosOrigin()`, `saocUrl(path)`, `nosUrl(path)`. No trailing slash on origins; `*Url('/x?y=1')` = origin + path verbatim.
- next.config `allowedDevOrigins` gains `nos.localhost`.

## Public NOS URLs are CLEAN (NOS Design R0.3 supersedes my earlier DECISION-1)
Public path P on the NOS host == internal `/national-show` + P. `/` is the hub. The proxy maps between them; no files are renamed beyond the route-group moves.

Route groups (URL-preserving `git mv`; groups add no URL segment):
- `app/(marketing)/` = SAOC only: /, /about, /societies, /judging, /events, /constitution, /members, /sponsors, /media-kit, /contact. SAOC chrome, SAOC metadata + Organization JSON-LD, metadataBase = saocOrigin().
- `app/(nos)/` = NOS only, internal paths unchanged: `/national-show/**`, `/tickets/**`, `/vsp`. NOS chrome, NosThemeScope, AdminPill, metadataBase = nosOrigin(). No ChromeFrame segment switch.
- `app/(shared)/` = host-neutral content, chrome by `headers()` host: /privacy, /terms, /refunds, /newsletter/unsubscribe (legal pages MIRRORED on NOS: same source, buyer stays on show site). `/contact` is NOT shared: it is SAOC's (show contact = SAOC contact).
- `app/admin`, `app/api`, `app/studio`, `app/og`, robots, sitemap: host-neutral (robots/sitemap host-aware via headers()).
- `app/layout.tsx`: drop hard-coded metadataBase/openGraph.url/canonical/JSON-LD (group layouts own them) so routes stay static.

## proxy.ts order
1. Wall first on BOTH hosts (decideBasicAuth unchanged; exempt webhook set unchanged; wall headers as today). Add response header `x-site: nos|saoc` on every non-401 response (test aid).
2. Pass-through, no host logic: `/api/**`, `/studio/**`, `/og/**`, `/_next/**`, `/robots.txt`, `/sitemap.xml`, `/events.ics`, favicon/icon files, any path with a file extension.
3. Admin is HOST-NEUTRAL (final lead ruling): `/admin/**` and `/api/admin/**` pass through on every host with no redirect. Sign-in works on any host; the session cookie is per host.
4. Host = saoc: `/national-show`, `/national-show/**`, `/tickets`, `/tickets/**`, `/vsp`, `/vsp/**` -> 308 `nosUrl(path+search)`. (SAOC `/` and other pages untouched.)
5. Host = nos:
   - SAOC-only set -> 308 `saocUrl(path+search)`: exact `/contact`, `/members`, `/constitution`, `/judging`, `/societies` and `/societies/**`, `/events` and `/events/**`.
   - `/national-show` exactly -> 308 `/`; `/national-show/<rest>` -> 308 `/<rest>` (old/internal links self-heal; query preserved).
   - Shared (`/privacy`, `/terms`, `/refunds`, `/newsletter/**`) and top-level show exceptions `/vsp/**` and `/tickets/<anything except buy>` (Ozow return/cancel + recovery URLs: `/tickets/confirmation`, `/tickets/cancelled`, `/tickets/recover`, `/tickets/<slug>`) -> continue unchanged (internal top-level routes; short paths exist for Ozow's 50-char CancelUrl cap, so they MUST stay).
   - `/` -> rewrite `/national-show`. `/tickets` exactly and `/tickets/buy/**` -> rewrite `/national-show/tickets[...]`. Every other path P -> rewrite `/national-show` + P (404 comes from the show tree's not-found).
6. All redirects are 308. Never redirect an exempt webhook path or /api.

## Robots / sitemap (host-aware)
Walled => `Disallow: /` on both (unchanged). Launched => each host lists its own sitemap. NOS sitemap = content/national-show-routes.json block + archive years with the `/national-show` prefix STRIPPED, URLs on nosOrigin(); SAOC sitemap = static SAOC routes + societies + events on saocOrigin(), no show entries.

## Link hygiene
NOS chrome, hub CTAs, payment/email URLs use clean NOS paths (helper `nosPath()` strips the prefix from nav-config/route-manifest hrefs). Remaining in-page `/national-show/...` links work via the step-5 308 and are an optional sweep, not a gate.
