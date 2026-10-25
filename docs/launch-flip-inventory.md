# Launch flip inventory

Goal: launch changes environment only (`NEXT_PUBLIC_SAOC_SITE_URL`, `NEXT_PUBLIC_NOS_SITE_URL` in `apphosting.yaml`),
never source. Origins flow through `lib/site-hosts.ts` for canonicals, the sitemap, `metadataBase` and the shared
metadata builders. `saocOrigin()` and `nosOrigin()` throw in production when their variable is unset, at call time, so
they are evaluated inside functions and never hoisted to module scope.

## Literal origins found at baseline, now routed through site-hosts

Found by grepping `https?://(beta.|nos.)?saoc.co.za` in `app`, `lib` and `components`, comments excluded.

| file | literal | now |
|---|---|---|
| `components/seo/JsonLd.tsx` `organizationJsonLd` `url` | `https://saoc.co.za` | `saocOrigin()` |
| `components/seo/JsonLd.tsx` `organizationJsonLd` contactPoint `url` | `https://saoc.co.za/contact` | `saocUrl('/contact')` |
| `components/seo/JsonLd.tsx` event organizer `url` (two builders) | `https://saoc.co.za` | `saocOrigin()` |
| `app/(marketing)/page.tsx` `BASE_URL` (openGraph `url`) | `https://saoc.co.za` | `saocOrigin()` inside `generateMetadata()` |
| `app/(marketing)/societies/[slug]/page.tsx` openGraph `url` | `https://saoc.co.za/societies/${slug}` | `saocUrl(`/societies/${slug}`)` |

The organizer is the SAOC organisation on both hosts, so it is `saocOrigin()` even on National Orchid Show pages.
`contracts/checks/audit-fixes-2026-10-25/check-no-hardcoded-origins.mjs` fails on any new literal.

## Decided later, copy not URL

Display text that mentions `saoc.co.za` but is wording, not a link the launch must retarget:

- `app/og/route.tsx`: the footer text of the generated share image.
- `lib/ticket-pdf.ts`: `FOOTER_LINE`.
- `app/(marketing)/sponsors/page.tsx`: the benefit line "Logo placement on saoc.co.za and event signage".
- `lib/email.ts`: the sender and reply-to domains (`tickets.saoc.co.za`, `forms.saoc.co.za`, `info@`, `show@`), which are
  Resend-verified domains configured by `RESEND_FROM_*` environment variables, not site origins.

## Not touched, on purpose

Launch gating stays a separate decision: `app/robots.ts`, the `X-Robots-Tag` and noindex headers, `proxy.ts`,
`lib/beta-public-launch.ts` (`SITE_PUBLIC_LAUNCH`), `TICKETING_PAYMENTS_LIVE` and the testing-mode banner and title
prefix. `check-scope.mjs` fails the audit batch if any of them changes.
