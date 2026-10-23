# Golden: absolute URLs, email links, payment URLs (nos-site-split F2)

Rule: every absolute URL that points at a show surface is built with `nosUrl()` from lib/site-hosts.ts; every one that points at an SAOC surface uses `saocUrl()`. No file other than lib/site-hosts.ts, apphosting.yaml, docs/, e2e/, .agent/ may contain the literals `nos.saoc.co.za` or `beta.saoc.co.za`.

Replace the private `resolveSiteUrl()` / `DEFAULT_SITE_URL` / `process.env.SITE_URL` fallbacks in:
- app/api/tickets/checkout/route.ts   -> return, cancel, notify (Ozow) URLs = nosUrl(...). Ozow stays the sandbox gateway; PayFast untouched; never touch SITE_PUBLIC_LAUNCH.
- app/api/vendors/stand-payment/initiate/route.ts, lib/vendor-stand-return.ts, lib/vendor-stand-payment-notification.ts -> nosUrl
- lib/confirmation-email.ts, lib/recovery-url.ts (ticket/recovery/PDF links) -> nosUrl
- lib/vendor-registration-confirmation.ts, lib/vendor-payment-confirmation.ts, lib/vendor-photo-resume-link.ts, lib/supporter-registration-handler.ts, app/api/vendors/apply/route.ts, app/api/vendors/register/route.ts -> nosUrl
- app/api/admin/vendors/**/review|resend-* routes (floor-blocked for read by this architect; dev reads them; vendor token/payment/photo links -> nosUrl)
- newsletter unsubscribe link in emails: nosUrl for source nos-footer subscribers, saocUrl otherwise (the page itself is host-neutral).
- app/api/admin/newsletter/export-csv/route.ts: only if it builds origin links.
- lib/seo.ts BASE_URL + sitemap/robots/layout: per-host (see host-routing golden). Show pages' canonical/OG url -> nosOrigin(); `app/(marketing)/national-show/og-image.ts` (moves with tree) likewise.
- lib/ics.ts: `UID:${slug}@saoc.co.za` is an identifier, not a URL: leave unchanged. Any URL inside .ics events is saocUrl (events are SAOC-only); show-related ics URL -> nosUrl.

apphosting.yaml: add `NEXT_PUBLIC_SAOC_SITE_URL=https://beta.saoc.co.za` and `NEXT_PUBLIC_NOS_SITE_URL=https://nos.saoc.co.za` with `availability: [BUILD, RUNTIME]` (NEXT_PUBLIC_* is inlined at build). Keep SITE_URL=https://beta.saoc.co.za (back-compat, = SAOC origin). Do NOT add SITE_PUBLIC_LAUNCH. Do not touch email sender variables (keep current senders; nos-tickets@/nos-forms@/nos-subscribe@ swap later).

Ozow: return/notify must be on the NOS origin whose host the sandbox can reach. Ozow sandbox does not allowlist domains per our docs/payment-gateway-selection.md reading; ops step O3 verifies.

## Revision after clean NOS URLs
All NOS URLs built here use clean paths: show pages `nosUrl('/symposium')`, never `/national-show/...`. Payment return/cancel keep the existing SHORT top-level routes: `nosUrl('/tickets/confirmation?ref=..')`, `nosUrl('/tickets/cancelled?ref=..')`, vendor stand return `nosUrl('/vsp')` (the vendor stand CancelUrl `nosUrl('/vsp')` plus its query must stay within Ozow's 50-char CancelUrl cap as lib/vendor-stand-return.ts documents; dev measures the longest generated vendor CancelUrl with the nos host and records it; ticket URLs have no such cap today). Recovery link `nosUrl('/tickets/recover?token=..')`. Vendor links: `nosUrl('/vendors/register?...')`, `/vendors/payment`, `/vendors/photos` per the existing internal paths minus the prefix. Admin-sent vendor emails (review/resend) use nosUrl too. Admin links inside emails/admin UI point to saocUrl('/admin/...').
