# F5 spec: image delivery, security headers, canonical, societies CLS

## 1. Image delivery - root cause finding (read this first)
Measured on a local production build (next 16.2.12, sharp 0.34.5 present, SITE_PUBLIC_LAUNCH=true, port 3411):
- /about emits next/image `srcSet` with 8 widths (640..3840), default `src` = `w=3840`.
- /_next/image?url=/images/orchid-purple.jpg&w=1920&q=75 returns 200, 3.1 MB source -> 92 KB image/webp.
So the app code, next.config.ts images block, and proxy.ts (no matcher, so it runs on /_next/image, but only
adds headers) do NOT produce the audit's "no srcset, /_next/image 404". No `unoptimized`, loader, or
NEXT_IMAGE_* anywhere in app/, components/, lib/, next.config.ts, apphosting.yaml.
proxy.ts:70-77 sets `private, no-store` + Set-Cookie while the wall is up: that defeats CDN caching of
optimised images (every beta view re-runs sharp on a 1 CPU / 1 GiB instance, which is the likely cause of
the audit's timeouts), but it does not remove srcset or cause a 404, and it lifts at launch.
The beta symptom is therefore a deploy/platform artefact that cannot be reproduced from the repo. The
contract pins everything controllable and adds a mandatory post-deploy probe (section 5).

Controllable defects the fix covers:
- images.formats unset -> webp only; add AVIF.
- default `src` width 3840 -> LCP fallback and non-srcset clients fetch a 3840 px image. Cap deviceSizes at 2048.
- Sanity URLs carry only `?w=` -> add `.auto('format')` in urlFor (sanity/lib/image.ts), callers keep their `.width()`.
- Raw 1.9-3.1 MB sources in public/images are NOT resized on disk (out of scope; the optimiser serves resized).

### Required changes
next.config.ts images block gains:
  formats: ['image/avif', 'image/webp']
  deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048]
  (imageSizes, remotePatterns unchanged; do not add `unoptimized`, `qualities`, or a custom loader)
sanity/lib/image.ts: `return builder.image(source).auto('format');`

## 2. Security headers (next.config.ts `async headers()`, source '/:path*')
| header | value |
|---|---|
| Strict-Transport-Security | max-age=31536000 (no includeSubDomains, no preload: old cPanel subdomains still exist) |
| X-Content-Type-Options | nosniff |
| Referrer-Policy | strict-origin-when-cross-origin |
| X-Frame-Options | SAMEORIGIN |
| Permissions-Policy | camera=(self), microphone=(), geolocation=() (camera=(self) is required: /admin/door scanner uses getUserMedia) |
| Content-Security-Policy-Report-Only | contents of csp-report-only.txt, verbatim, one line |
Never set: enforcing Content-Security-Policy, Cross-Origin-Opener-Policy (breaks Firebase Auth popups),
Cross-Origin-Embedder-Policy. Report-only has no report-uri; browsers log violations to the console only.
X-Frame-Options SAMEORIGIN keeps Studio and its own previews working. PayFast/Ozow are top-level
redirects, unaffected. /_next/image keeps Next's own enforcing CSP (not ours to touch).
The existing /events.ics redirect stays.

## 3. Canonical
app/layout.tsx metadata gains `alternates: { canonical: './' }`. Pages returning their own `alternates`
(buildPageMetadata, lib/seo.ts:62) replace the layout object (Next shallow-merges metadata keys), so no
duplicates: the check demands exactly one canonical link per page, equal to https://saoc.co.za + path, query ignored.

## 4. /societies fallback
app/(marketing)/societies/page.tsx:96 `fallback={null}` -> an element reserving the space of the client
(filter header plus a card grid). Build it from existing classes only, copying the pattern of
app/(marketing)/tickets/loading.tsx: `animate-pulse`, `border border-rule`, `bg-bone`, `aria-busy`, an sr-only
"Loading societies" label. Grid classes identical to SocietiesClient.tsx:101
(`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`), wrapper `space-y-8` as SocietiesClient.tsx:52,
card block height approximating SocietyCard, 6 cards. No new colours, no new tokens, no brand decisions.
May live inline or as one new file (SocietiesFallback.tsx). CLS budget 0.05 at 390 and 1440 wide.

## 5. Post-deploy acceptance and fallback
Confirmed by orchestrator probe of beta with Basic auth (2026-10-16): /_next/image returns 404 (text/html) and /about HTML has zero /_next/image references, with raw `src="/images/orchid-*.jpg"` and no srcset. The repo has no `unoptimized` flag, so this is a deploy/platform cause (the deployed build or the App Hosting adapter is disabling the optimiser). The curl probe below is the post-deploy acceptance check.

Alternative path, only if the platform cannot serve the optimiser: pre-resize the public/images heroes to <=2048 px WebP at build time and point the hero `src` values at them. This stays inside repo control and needs no new design. It is an alternative, not an assertion; the scope allowlist would need public/images and the build script added if it is taken.

### Post-deploy probe
 (manual, not a gate assertion; the gate cannot reach the Basic-auth wall)
After deploy to beta, with credentials: curl -I with Accept: image/avif,image/webp against
/_next/image?url=%2Fimages%2Forchid-purple.jpg&w=1920&q=75 -> expect 200, image/avif or webp, < 300 KB;
page HTML must contain srcSet. If 404 persists, the cause is the App Hosting platform, not this repo:
escalate with that curl output.

## Out of scope
Contrast tokens, fonts, JSON-LD, sitemap, redirects, resizing files in public/images, proxy.ts changes.

## Run order
SITE_PUBLIC_LAUNCH=true pnpm build; SITE_PUBLIC_LAUNCH=true pnpm start -p 3411 (any free port except 3000/3002;
set BASE_URL); then the gate. Kill only your own server.
