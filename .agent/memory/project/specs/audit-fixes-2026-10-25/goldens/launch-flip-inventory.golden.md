# Golden: launch-flip inventory, as data (audit "Launch flip list")

Goal: launch changes env only (NEXT_PUBLIC_SAOC_SITE_URL, NEXT_PUBLIC_NOS_SITE_URL in apphosting.yaml),
never source. Origins already flow through lib/site-hosts.ts for canonicals, the sitemap, metadataBase and
the shared metadata builders. The residue is exactly these literals (grep `https?://(beta.|nos.)?saoc.co.za`
in app, lib, components, comments excluded), found at baseline:

| file | literal | route through |
|---|---|---|
| components/seo/JsonLd.tsx organizationJsonLd `url` | https://saoc.co.za | saocOrigin() |
| components/seo/JsonLd.tsx organizationJsonLd contactPoint `url` | https://saoc.co.za/contact | saocUrl('/contact') |
| components/seo/JsonLd.tsx event organizer `url` (two builders) | https://saoc.co.za | saocOrigin() |
| app/(marketing)/page.tsx `BASE_URL` | https://saoc.co.za | saocOrigin() |
| app/(marketing)/societies/[slug]/page.tsx openGraph `url` | https://saoc.co.za/societies/${slug} | saocUrl(`/societies/${slug}`) |

The organizer is the SAOC organisation on both hosts, so it is `saocOrigin()` even on NOS pages.
Evaluate lazily inside the functions (site-hosts throws in production when the variable is unset, at call
time by design); do not hoist a call to module scope.

Required result: `check-no-hardcoded-origins.mjs` finds nothing, and the three files import from
`@/lib/site-hosts`. Write the table above, plus the residual display-text mentions of "saoc.co.za" that are
copy rather than URLs (app/og/route.tsx footer text, lib/ticket-pdf.ts FOOTER_LINE, sponsors benefit line,
lib/email.ts sender domains in env) into docs/launch-flip-inventory.md as "decided later, copy not URL".

Hard non-goals, enforced by check-scope.mjs: do NOT touch app/robots.ts, the X-Robots-Tag/noindex headers,
proxy.ts, lib/beta-public-launch.ts (SITE_PUBLIC_LAUNCH), or the testing-mode banner and title prefix.
