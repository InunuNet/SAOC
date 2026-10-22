# NOS site split

Mission `nos-site-split` (2026-10-23). One Next.js app and one Firebase App Hosting
backend serve two hosts. Spec:
[`.agent/memory/project/specs/nos-site-split/`](../.agent/memory/project/specs/nos-site-split/contract.yaml).
Origins: [`lib/site-hosts.ts`](../lib/site-hosts.ts). Routing: [`proxy.ts`](../proxy.ts).

## Why

Brad, 2026-10-23: `nos.saoc.co.za` is the National Orchid Show's own site.
`beta.saoc.co.za` stays the SAOC site. The show tree, tickets and vendors leave the
SAOC host. Chrome cross-links both ways, same tab, no external-link mark (design
ruling R0.2). The beta password wall, the Ozow sandbox and the current Resend
senders stay as they are.

`/` on the NOS host is the show hub that was `/national-show`. Public NOS hrefs
drop that prefix (R0.3). Each header carries only its own logo (R0.4).

## Hosts and environment

[`apphosting.yaml`](../apphosting.yaml) declares both public origins at BUILD and
RUNTIME. `NEXT_PUBLIC_*` is inlined at build.

| Variable | Value | Availability |
|---|---|---|
| `NEXT_PUBLIC_SAOC_SITE_URL` | `https://beta.saoc.co.za` | BUILD, RUNTIME |
| `NEXT_PUBLIC_NOS_SITE_URL` | `https://nos.saoc.co.za` | BUILD, RUNTIME |
| `SITE_URL` | `https://beta.saoc.co.za` | RUNTIME |

`SITE_URL` is the SAOC origin, kept for back-compat. `SITE_PUBLIC_LAUNCH` is absent.
Email sender variables are unchanged.

`lib/site-hosts.ts` is the only origin builder. Trailing slashes are stripped.

- SAOC: `NEXT_PUBLIC_SAOC_SITE_URL`, else `http://localhost:3002` when
  `NODE_ENV !== 'production'`.
- NOS: `NEXT_PUBLIC_NOS_SITE_URL`, else `http://nos.localhost:3002` when
  `NODE_ENV !== 'production'`.

`SITE_URL` no longer feeds either origin. The NOS header is a client component, so
`NosFrame` resolves the SAOC hrefs on the server and passes them in as props.

There is no production fallback. In production an unset `NEXT_PUBLIC_*` variable
throws `<VAR> must be set in production (site origin)`. It throws lazily, inside
`saocOrigin()` or `nosOrigin()`, so the module stays edge-safe. A `pnpm build` with
either variable unset fails on the first page that resolves an origin. CI's Build step
sets both to the hosted values from `apphosting.yaml`. The static `safety` check fails
if either variable is missing from `apphosting.yaml`.
`siteForHost` reads `x-forwarded-host` (first value) or else `host`, strips the
port, and lower-cases it. `beta.saoc.co.za`, any `*.hosted.app` host, localhost and
the apex are `saoc`. A host is `nos` when its hostname equals the NOS origin's
hostname or starts with `nos.`.

Exports: `Site`, `siteForHost`, `saocOrigin`, `nosOrigin`, `saocUrl`, `nosUrl`.
`*Url(path)` is origin plus path, verbatim. Show, payment and email absolute URLs
use these helpers. [`lib/nos-paths.ts`](../lib/nos-paths.ts) `nosPath()` strips a
leading `/national-show`, keeping query and hash. The literals `nos.saoc.co.za` and
`beta.saoc.co.za` stay out of `app/`, `lib/` (except `lib/site-hosts.ts`),
`components/`, `proxy.ts`, `sanity/` and `content/` (except `content/drive*`).

## Proxy order

The password wall runs first, on both hosts, with the same `decideBasicAuth`
contract and the same six exempt webhook paths
([`docs/beta-password-wall.md`](beta-password-wall.md)). A 401 returns before any
redirect. Wall headers apply on both hosts while the wall is up. Every allowed
response sets `x-site: nos|saoc`. Redirects are 308.

1. Host-neutral paths pass through, with no host logic: `/admin`, `/api` (including
   payment webhooks), `/studio`, `/og`, `/_next`, `/robots.txt`, `/sitemap.xml`,
   `/events.ics`, the icon files, and any path whose last segment contains a dot.
2. On the SAOC host, `/national-show`, `/tickets` and `/vsp` (exact or under) 308
   to that same path on the NOS origin, query included. `/national-show/x` therefore
   hops twice: SAOC sends the prefixed URL, then NOS strips it. Other SAOC pages
   stay.
3. On the NOS host, SAOC-only paths 308 to the SAOC origin: exact `/contact`,
   `/members`, `/constitution`, `/judging`, plus `/societies` and `/events` and
   their children. `/contact` is the show contact. It is SAOC's page.
4. On the NOS host, `/national-show` 308s to `/`, and `/national-show/<rest>` 308s
   to `/<rest>`, query preserved. `/national-show/og` stays: it is the NOS share
   card, and `/og` is the SAOC card.
5. On the NOS host, `/` rewrites to `/national-show`. `/tickets` and `/tickets/buy`
   rewrite under `/national-show`. Every other public path `P` rewrites to
   `/national-show` + `P`. A miss 404s from the show tree.
6. `/tickets/confirmation`, `/tickets/cancelled`, `/tickets/recover`, other
   `/tickets/<slug>` paths, and `/vsp` stay top-level on NOS. Ozow return, cancel
   and notify, and the recovery link, use those short paths. Vendor stand return is
   `nosUrl('/vsp')` because Ozow caps `CancelUrl` at 50 characters
   ([`lib/vendor-stand-return.ts`](../lib/vendor-stand-return.ts)). Ticket notify
   is `nosUrl('/api/tickets/ozow-itn')`. `/privacy`, `/terms`, `/refunds` and
   `/newsletter` also pass through.

While walled, robots disallow `/` on both hosts. After `SITE_PUBLIC_LAUNCH` is the
exact string `true`, each host lists its own sitemap. The NOS sitemap is the show
manifest with the prefix stripped, on `nosOrigin()`. The SAOC sitemap is SAOC
pages, societies and events, on `saocOrigin()`, with no show entries.

## Route groups

- `app/(marketing)/` is SAOC only (the group adds no URL segment): `/`, `/about`, `/societies`, `/judging`,
  `/events`, `/constitution`, `/members`, `/sponsors`, `/media-kit`, `/contact`.
  SAOC chrome. `metadataBase` is `saocOrigin()`.
- `app/(nos)/` is the show, at internal `/national-show/**`, `/tickets/**` and
  `/vsp`. NOS chrome. `metadataBase` is `nosOrigin()`. The `ChromeFrame` segment
  switch is gone.
- `app/(shared)/` is `/privacy`, `/terms`, `/refunds` and `/newsletter/unsubscribe`.
  [`lib/request-site.ts`](../lib/request-site.ts) picks chrome from
  `x-forwarded-host` or `host`, so a buyer on NOS reads the legal pages on the show
  site.
- `app/admin`, `app/api`, `app/studio` and `app/og` are host-neutral. The root
  layout does not hard-code `metadataBase`.

SAOC `/sponsors` reads Sanity `sponsor`. NOS `/sponsors` (internal
`/national-show/sponsors`) reads `showSponsor`.

SAOC chrome points "National Show" at `nosUrl('/')`: header, utility pill, footer,
home hero and the next-show band. The show mega menu is removed. NOS chrome uses
clean paths. Contact and Constitution are absolute SAOC URLs. The mobile panel
ends with a text credit to the SAOC home.

## Admin

`/admin` and `/api/admin` are served on every host. There is no admin redirect
between hosts. Design ruling R5.2 (one SAOC admin origin) was overridden: sign-in
works on the host the operator is using.

The session cookie is `session`, set by `POST /api/admin/session` with `httpOnly`,
`secure`, `path=/`, `sameSite=strict`, and no `Domain`. The browser scopes it to
the host that set it. A session on `beta.saoc.co.za` is a different cookie from one
on `nos.saoc.co.za`. Google sign-in needs that host in Firebase Auth authorized
domains. Admin chrome is the existing SAOC admin frame on both hosts.

## Media kit

Both kits require an admin session until a members system exists. `/members` says
member login and the Members Portal have not been built. The only login is the
admin Firebase session ([`docs/admin-access.md`](admin-access.md)).

[`lib/media-kit-gate.ts`](../lib/media-kit-gate.ts) `requireMediaKitAccess` calls
`getAdminSession()`. Otherwise it `redirect()`s (307) to `/admin/login?next=<path>`
on the same host. SAOC passes `/media-kit`. The NOS page
(`app/(nos)/national-show/media-kit`) passes the public path `/media-kit`. The gate
ignores the password wall, so it holds while walled and after launch.

[`lib/safe-next-path.ts`](../lib/safe-next-path.ts) keeps `next` only when it is a
single leading slash, not `//`, with no backslash or control character. Anything
else becomes `/admin`. The login page uses that helper after sign-in. The NOS kit
reuses the National Show 2027 section of the existing manifest. The NOS footer
Media kit link points at the NOS kit. Constitution is `saocUrl('/constitution')`.

## Newsletter topics

Store behaviour is in [`docs/newsletter-subscribe.md`](newsletter-subscribe.md).
This mission adds `topics`.

`source` stays `saoc-footer` or `nos-footer`. `topics` is `saoc` and/or `nos`,
stored in that order. A body with no `topics`, and a legacy document with no
`topics` field, derive one topic from `source`. No backfill. An empty list or an
unknown topic is 400. Re-subscribe unions topics into the existing list, sets
`status` to `subscribed`, and keeps the original token and source.

Unsubscribe, on the host-neutral token page, unsubscribes the whole address.
Topic-level unsubscribe is out of scope.

The admin CSV is `email,source,subscribedAt,unsubscribeUrl,topics`, topics joined
by `;`. `unsubscribeUrl` uses the NOS origin for `nos-footer` and the SAOC origin
otherwise, never the request Host.

Both footers put two checkboxes under the email field, labelled
`NEWSLETTER_COPY.adminSourceSaoc` ("SAOC") and `adminSourceNos` ("National Orchid
Show"). The site's own list is first and pre-checked. Both unchecked blocks the
submit, flags the group, and focuses the first checkbox.

## Local development

`pnpm dev` is port 3002. SAOC is `http://localhost:3002`. NOS is
`http://nos.localhost:3002`. `next.config.ts` `allowedDevOrigins` includes
`nos.localhost` (dev only). `pnpm dev:secure` is the SAOC HTTPS host on port 3333.
Playwright requests show URLs with `Host: nos.localhost:<port>` and clean paths.

## Running the gate

Static checks, no server:

```bash
bash scripts/checks/nos-split-static.sh trees
bash scripts/checks/nos-split-static.sh host-literals
bash scripts/checks/nos-split-static.sh no-saoc-fallback-in-show-urls
bash scripts/checks/nos-split-static.sh safety
bash scripts/checks/nos-split-static.sh newsletter
```

The HTTP gate needs a production build with the origins it will request, because
`NEXT_PUBLIC_*` is inlined at build. The checker then starts `next start -p 3217`
and sets the same origins plus the wall credentials. GET and HEAD only. Logs:
`.tmp/sandbox/nos-split/next-start.log`.

```bash
NEXT_PUBLIC_SAOC_SITE_URL=http://saoc.localhost:3217 \
NEXT_PUBLIC_NOS_SITE_URL=http://nos.localhost:3217 \
pnpm build
node scripts/checks/nos-split-http.mjs
```

That `next start` also sets `NODE_ENV=production`,
`SITE_URL=http://saoc.localhost:3217`, `BETA_BASIC_AUTH_USER=sandbox`,
`BETA_BASIC_AUTH_PASSWORD=sandbox-pass`, and an empty `SITE_PUBLIC_LAUNCH`. It
checks the wall on both hosts, the 308 matrix, shared and neutral routes, robots,
sitemaps, cross-links and the media-kit 307. `decideBasicAuth` stays covered by
`pnpm exec playwright test e2e/beta-password-wall-decision.spec.ts`.

## Operations

Done:

- DNS for `nos.saoc.co.za` via wh3.
- App Hosting custom domain for `nos.saoc.co.za` on this backend. The beta Basic
  Auth secrets apply here, so the NOS host is behind the same wall.
- Firebase Auth authorized domain `nos.saoc.co.za` (Google sign-in on NOS).

Pending:

- Resend: verify the `saoc.co.za` domain before changing senders. Current senders
  stay `tickets@tickets.saoc.co.za` and `noreply@forms.saoc.co.za`. Later addresses
  in the spec: `nos-tickets@`, `nos-forms@`, `nos-subscribe@`.
- `nos-*` mailbox forwarders.
- Ozow sandbox: confirm the sandbox site code accepts return, notify and cancel
  URLs on `https://nos.saoc.co.za`. Sandbox only. No live mode. PayFast is
  untouched. `lib/site-hosts.ts` does not reference it.

Still open in the research note: Sanity CORS and the draft / revalidate origins
for `https://nos.saoc.co.za`. Studio stays on the beta host. Cloud Scheduler
`reconcile-orders` keeps calling the beta origin (exempt path, host-neutral).

## Known gaps

- **Credit label (R2.3).** The NOS footer credit is one link to `saocUrl('/')`:
  the SAOC mark, `FOOTER_ORG_NAME`, and `FOOTER_REG`. The label above them is a
  COPY GAP. The design note recommends "Organised by". Public mode omits the
  label. The beta preview shows the marker "To be confirmed".
- **Chooser legend (R4.4).** COPY GAP. The fieldset legend is visually hidden and
  reads `FOOTER_HEADINGS.touch` ("Stay in touch").
- **None-selected error (R4.5).** COPY GAP. `NEWSLETTER_COPY` has no approved
  string. Preview shows
  `COPY GAP — AI-generated placeholder: Select at least one newsletter topic.`
  Public mode withholds that sentence (`withholdPlaceholderProse()`). The alert
  is then screen-reader only (`NEWSLETTER_COPY.genericError`). Submit stays blocked.
- **Members.** No member authentication exists. Both media kits admit an
  allowlisted admin session only, until a members check replaces
  `requireMediaKitAccess`.
