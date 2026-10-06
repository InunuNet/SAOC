# Beta Password Wall

Mission `beta-password-wall` (M1/F1 + M1/F2), 2026-10-06.

## Why it exists

Brad asked for this on 2026-10-06, the same day as a meeting with Lee-Ann: "we
need to put up a password wall for beta.saoc.co.za so the search and public
don't find it by accident." The live backend at the time had no protection at
all — anyone, including search engine crawlers, could reach every page.

The deadline for public launch is **1 December 2026** (Brad, 2026-10-06). Until
then the whole site sits behind this wall. See [Launch procedure](#launch-procedure-target-1-december-2026)
below.

## How it works

`proxy.ts`, at the repo root, is Next 16's canonical proxy convention (the
successor to the deprecated `middleware.ts` / `export function middleware` —
Next's loader accepts `middlewareModule.proxy || middlewareModule.middleware`,
and `NextMiddleware`/`MiddlewareConfig` are tagged `@deprecated` in favour of
`NextProxy`/`ProxyConfig`). It has no `config.matcher` export, so it runs on
**every request** — every page and every static asset — which is Next's own
documented default when a matcher is absent.

Four protections are wired together and can only ever lift as one:

1. **HTTP Basic Auth**, enforced by `proxy.ts`'s `decideBasicAuth()` (a pure,
   `NextRequest`-free decision function, unit-tested directly by
   `e2e/beta-password-wall-decision.spec.ts`). An unauthenticated or wrongly
   authenticated request gets a 401 with `WWW-Authenticate: Basic realm="SAOC
   Beta", charset="UTF-8"`.
2. **`X-Robots-Tag: noindex, nofollow`**, set on both the 401 and the 200
   response, so the noindex guarantee doesn't depend on whether the visitor
   has the password — a credentialed BrowserAgent or human reviewer must not
   accidentally get indexed either.
3. **`app/robots.ts`** disallow-all (`export const dynamic = 'force-dynamic'`,
   so it re-reads the launch flag on every request rather than baking in
   whatever value was present at build time).
4. **CDN-unstorable responses.** While the wall is up, every response
   `proxy.ts` returns carries `Cache-Control: private, no-store, max-age=0`
   plus a marker cookie, `Set-Cookie: saoc_beta_wall=1` (`WALL_CACHE_CONTROL`
   / `WALL_MARKER_COOKIE` in `proxy.ts`). Two independent mechanisms, both
   from Cloud CDN's documented never-cache list
   (https://firebase.google.com/docs/app-hosting/optimize-cache), because
   either one alone has a gap:
   - The `Cache-Control` header survives on most responses, because Next
     copies proxy headers onto the response **before** rendering and only
     writes its own `Cache-Control` when none already exists
     (`send-payload.js:60`, `router-server.js:394`).
   - The marker cookie exists because two paths overwrite `Cache-Control`
     *after* `proxy()` runs and would otherwise escape the first mechanism:
     the image optimizer always sets `public, max-age=...`
     (`image-optimizer.js:1180`), and a route handler's own headers win (the
     `ImageResponse` at `app/og`). Firebase App Hosting's Cloud CDN never
     caches a response carrying `Set-Cookie`, whatever its `Cache-Control`
     says — so the cookie protects exactly the cases the header can't. The
     cookie's value carries no data.
   - **`Vary: Authorization` is deliberately not used.** Next replaces
     `Vary` on every page (`build/templates/app-page.js:446`) and image
     response, so it would be absent exactly where it mattered.
   Both mechanisms lift together with `SITE_PUBLIC_LAUNCH`, at runtime,
   restoring Next's own caching headers — see
   [Launch procedure](#launch-procedure-target-1-december-2026) below.

**Host-agnostic by design.** All four apply identically on every host this
backend answers on — `beta.saoc.co.za`, any `*.hosted.app` preview origin, and
the real `saoc.co.za` apex — with zero host-matching logic anywhere. An
earlier draft of this feature keyed all three off a `saoc.co.za`/`www.saoc.co.za`
allowlist that would have auto-lifted the moment DNS migrated the real apex
onto this backend. That was rejected: the domain migration (see project memory
`project_domain_migration_resend_sequencing`) can land before the council
actually decides to launch publicly, and a host-based auto-lift would have
silently removed every protection at that exact moment — precisely the
accidental exposure this mission exists to prevent. Launch has to be a
deliberate act, never a side effect of an unrelated DNS/email sequencing
change.

## Incident: CDN cache bypass (2026-10-06)

@qa's first deployed pass against F2 (commit fd5b763f) found a confirmed,
live, critical defect: a cache hit never reaches `proxy.ts` at all, and
Firebase App Hosting's front-door Cloud CDN replayed an authenticated ISR
page back to anonymous visitors.

**What happened.** An authenticated `curl -u` request and an unauthenticated
probe landed on `https://beta.saoc.co.za/` moments apart. The anonymous
request got a **200** — the full 79KB real homepage, `cdn-cache-status: hit`,
`cache-control: s-maxage=60, stale-while-revalidate=31535940`, no
`WWW-Authenticate` challenge — for about a minute (the ISR page's own
`s-maxage=60` TTL) before it reverted to 401/miss on its own. The pre-fix
`proxy()` returned `NextResponse.next()` on the allowed path and only ever
set `X-Robots-Tag`; it never touched `Cache-Control` or added any
cache-defeating signal, so the downstream page's own CDN-cacheable ISR
headers passed straight through untouched. The CDN had no reason to treat
the response as anything but publicly cacheable, and served the first 200 it
saw for that URL to the next requester regardless of credentials — meaning
any single real authenticated page load (by Brad, a reviewer, or a QA pass)
could re-open the bypass window for everyone else, for as long as the cached
entry survived. This directly defeated the wall's purpose: keeping the beta
site non-public before launch.

**Why the point-in-time contract assertions didn't catch it.** Every
assertion in the original contract (A7–A11) is a single curl/fetch at one
moment; none is structured to observe a TTL-windowed cache hit that only
appears after a specific authenticated-then-anonymous access pattern against
the live CDN.

**Fix.** The [CDN-unstorable responses](#how-it-works) protection above,
shipped at commit ba2c7933. No separate CDN purge step was needed or is
available — Firebase App Hosting has no purge API
(`docs/f1-cdn-purge-api-findings.md`); a rollout is the only purge, and
entries stored before the fix carried `s-maxage=60`, which Cloud CDN does
not serve stale, so nothing pre-fix survived the rollout.

## Exempt webhook paths

Six machine-to-machine routes cannot send a Basic Auth header and already
verify their own signature/secret independently, so they're exempt from the
wall unconditionally — even once the site is publicly launched, since their
own checks are the real gate either way:

- `/api/tickets/itn`
- `/api/tickets/ozow-itn`
- `/api/vendors/stand-payment/payfast-itn`
- `/api/vendors/stand-payment/ozow-itn`
- `/api/revalidate`
- `/api/admin/reconcile-orders`

`proxy.ts`'s `isExemptPath()` matches these with `Set.has()` against the exact,
runtime-normalised pathname — never a prefix/`startsWith` check. A prefix
match would also exempt a near-miss like `/api/tickets/itn-evil`, or (before
WHATWG URL normalisation resolves `..` segments) a traversal attempt like
`/api/revalidate/../admin`. QA verified both: `itn-evil` and the traversal
shape both get walled (401), not exempted.

QA also found that Next's own trailing-slash/double-slash normalisation issues
a **308 redirect to the canonical path before `proxy()`'s own response is
built for that hop** — so the 308 itself carries neither `X-Robots-Tag` nor
`WWW-Authenticate`. This is not a bypass: the redirect target is itself fully
walled (confirmed for both exempt-shaped and non-exempt paths), and the
`Location` header only ever points at a route path a crawler already knows
from the public route structure. No content is exposed by the 308 hop itself.

## Fail-closed behaviour; the dev/Playwright bypass

`decideBasicAuth()`'s precedence, in order:

1. Exempt paths always pass, in every environment, on every host.
2. `isPubliclyLaunched()` (see below) always passes when true.
3. If `BETA_BASIC_AUTH_USER`/`BETA_BASIC_AUTH_PASSWORD` are unset:
   - **production** (`NODE_ENV === 'production'`) → **deny everything.** No
     credential could ever satisfy an unconfigured secret, so this is what
     "fail closed" means here — not a special-cased error branch, just the
     ordinary consequence of nothing being able to match an absent value.
   - **anywhere else** (`pnpm dev` / `pnpm dev:secure`, and the Playwright e2e
     suite's `next dev` webServer, per `playwright.config.ts`'s own header
     comment) → **allow**, so local development and the e2e suite keep
     working with zero setup.
4. Otherwise, parse the `Authorization` header as Basic, decode it, and
   compare both the username and the password with `constantTimeEqual()` —
   both must match.

This bypass is independent of `isPubliclyLaunched()` and is never itself a way
to lift the wall in production — it only ever applies when
`NODE_ENV !== 'production'`.

## Constant-time comparison on the Edge runtime

`proxy.ts` runs on the Edge runtime — Next's proxy/middleware has no
`runtime: 'nodejs'` escape hatch (`MiddlewareConfigInput` exposes only
`matcher`/`regions`/`unstable_allowDynamic`), so `node:crypto`'s
`timingSafeEqual` and `Buffer` aren't available. `constantTimeEqual()` instead:

1. SHA-256-digests both inputs via Web Crypto (`crypto.subtle.digest`,
   available on the Edge runtime) to a fixed 32-byte length.
2. XOR-accumulates over every byte of both digests with no early return
   (`mismatch |= digestA[i] ^ digestB[i]`).

The loop's running time depends only on the fixed digest length (always 32
bytes), never on the length or content of the real secret or of whatever a
caller supplied.

### Known gap: credentials must be ASCII-only

QA found a real, non-blocking defect: **non-ASCII Basic Auth credentials never
authenticate.** The Authorization header is decoded with `atob()`, which
returns a binary string (one JS char code per decoded byte). For a multi-byte
UTF-8 character, that string is already byte-split; `constantTimeEqual()`
then runs `TextEncoder().encode()` on it, which re-encodes each of those
byte-values as UTF-8 *again*, producing a different byte sequence than the
plain JS string's own UTF-8 encoding would. The two digests can never match.

This is a **lockout risk, not an auth bypass** — no security impact. The
current credentials are ASCII, and every golden test credential is ASCII.
Tracked as a backlog item (see below); fixing it would mean decoding the
Authorization header with a proper UTF-8-aware base64 decode instead of raw
`atob()`.

## Known cost: static assets re-download until launch

`/_next/static/*` stays walled **and** private while the wall is up — not
publicly cached — because build chunks carry client-component copy
(unreleased page text) and Brad's instruction was "every page and asset."
The cost: testers' browsers re-download JS/CSS chunks on every full page
load (a client-side navigation keeps already-loaded chunks in memory, so
this only bites on a hard reload or fresh tab) until `SITE_PUBLIC_LAUNCH` is
set and Next's normal long-lived `immutable` caching resumes.

## Known gap: `next/image` with a local `src` returns 400 while walled

The image optimizer's internal self-fetch (`image-optimizer.js:994-1004`, a
mocked request with no headers) carries no credentials, so it hits the wall
itself and gets the 401 body back instead of the real image — any
`next/image` using a **local** `src` (e.g. the header logo,
`/images/saoc-logo-ink-paper.png`) returns 400 until launch. Remote sources
(`cdn.sanity.io`) are unaffected, since those fetches go straight to the
remote host rather than back through this app's own wall. A plain
`<img src="/images/...">` also works, since it bypasses the optimizer
entirely.

Fixing it would mean exempting `/_next/image` (or the specific local asset
paths it serves, e.g. `/images/*` and `/_next/static/media/*`) from the
wall. That is an open scope decision, not yet made — not part of the CDN
cache fix above.

## The one launch switch: `SITE_PUBLIC_LAUNCH`

`lib/beta-public-launch.ts` exports `isPubliclyLaunched(flagValue)`:

```ts
export function isPubliclyLaunched(flagValue: string | undefined): boolean {
  return flagValue === 'true';
}
```

An **exact, case-sensitive** match against the literal string `'true'`.
`'TRUE'`, `'1'`, an empty string, and unset all mean "stay walled" — fail
closed, the same principle as the unset-credentials branch above. `proxy.ts`
and `app/robots.ts` both read this one function, so the Basic Auth wall, the
`X-Robots-Tag` header, the robots disallow-all, and the CDN-unstorable
Cache-Control/marker-cookie pair can only ever lift together, by the same
one explicit action.

`SITE_PUBLIC_LAUNCH` is a plain **RUNTIME** env var — not a secret — and is
**absent from `apphosting.yaml` entirely** until the day the council actually
decides to go public.

## Launch procedure (target 1 December 2026)

1. Add to `apphosting.yaml`, under `env:`, as a RUNTIME plain value:
   ```yaml
   - variable: SITE_PUBLIC_LAUNCH
     value: "true"
     availability:
       - RUNTIME
   ```
   The string must be the exact literal `true` — `TRUE`, `1`, or anything
   else stays walled.
2. Roll out.

That one change lifts the Basic Auth wall, the `X-Robots-Tag: noindex` header,
the `robots.txt` disallow-all, **and** the CDN-unstorable `Cache-Control`/
marker-cookie pair together, on every host — restoring Next's own normal
caching headers (ISR `s-maxage`, static-asset `max-age=31536000, immutable`,
etc.) at the same moment.

**The `saoc.co.za` DNS/nameserver migration is a separate step and does not
launch the site.** It can land before or after this change; it must never be
treated as a substitute for it (see [Host-agnostic by design](#how-it-works)
above for why).

## Credentials

Stored in Secret Manager as `BETA_BASIC_AUTH_USER` and `BETA_BASIC_AUTH_PASSWORD`,
wired into `apphosting.yaml` as RUNTIME-only secret references (never BUILD —
a BUILD entry would bake the value into the publicly-inspectable client
bundle, defeating the wall). The same values are mirrored in `.env.local` for
local use; both are left **unset by default** in `.env.local.example` so
`pnpm dev` / `pnpm dev:secure` and the Playwright suite keep working with zero
setup. Setting them locally deliberately opts a developer into testing the
wall itself against a local server.

**Retrieve:**

```bash
firebase apphosting:secrets:access BETA_BASIC_AUTH_PASSWORD --project saoc-webapp
```

**Rotate:** generate a new random value, then:

```bash
firebase apphosting:secrets:set BETA_BASIC_AUTH_PASSWORD --data-file=- --project saoc-webapp
```

piping the value via stdin (never argv, so it never appears in a shell history
or tool-call record), then redeploy so the new value takes effect.

Never write a credential value into this document, a commit, or a chat
transcript.

## How gate and live checks authenticate

Two project-owned Playwright check scripts drive a real browser against the
deployed `https://beta.saoc.co.za` origin and needed updating once the wall
went up, since an unauthenticated session would otherwise never get past the
401:

- `contracts/checks/door-checkin-one-handed-f1/check-live-viewport.mjs`
- `contracts/checks/admin-settings-deploy-and-chrome-fix-f1/check-live-chrome.mjs`

Both read `BETA_BASIC_AUTH_USER`/`BETA_BASIC_AUTH_PASSWORD` from the
environment and, only when **both** are set, spread an `Authorization: Basic
...` header into their plain `fetch()` calls and an `httpCredentials` option
into `browser.newContext({...})` — so Playwright's own browser context
authenticates automatically for subsequent navigations, not just the first
request. When either variable is unset, every one of these conditionals
evaluates to an empty object: zero behaviour change against a local or
otherwise-unwalled target.

Two more checks, added by the RETRY 1 cache fix, authenticate differently:

- **A10** (`contracts/checks/beta-password-wall/check-cache-headers.mjs`) is
  the **local production-server header proof**: it builds, starts a real
  `next start` on a free port with throwaway random credentials (never
  printed, server always killed afterward), and asserts the full
  CDN-unstorable contract — walled responses carry the marker cookie and
  `private, no-store` Cache-Control across ISR, RSC, static, SSG, dynamic,
  404, robots, sitemap, API, public file, favicon, build chunk, and both
  local and remote `/_next/image`/`/og`; a launched server (`SITE_PUBLIC_LAUNCH=
  'true'`) serves `/` with Next's own `s-maxage` restored and no marker. It
  needs no deployed credentials at all — it mints and discards its own.
- **A13** (`contracts/checks/beta-password-wall/check-deployed-cdn-pairs.mjs`)
  is the **deployed CDN replay proof** and does need exported credentials
  (`BETA_BASIC_AUTH_USER`/`BETA_BASIC_AUTH_PASSWORD` in the gate-running
  shell's environment, same as the two scripts above). It reproduces the
  exact incident trigger against the live origin: authenticated GET
  immediately followed by an anonymous GET of the identical URL, repeated
  across `/`, `/privacy`, a build chunk, and a remote optimized image, for
  several rounds — asserting neither leg is ever a CDN cache hit. Critically,
  **A13 must run only after the fixed build has already been rolled out** —
  against an unfixed build, its own authenticated half would re-open the
  live bypass window it exists to detect, repeating the 2026-10-06 incident
  on purpose. There is no separate purge step to run first; a rollout is
  Firebase App Hosting's only purge.

## Known gap: Athanor#1459

[`InunuNet/Athanor#1459`](https://github.com/InunuNet/Athanor/issues/1459) —
`execution/browser_deployed_check.sh` is harness-owned and was not patched
(per `.claude/rules/athanor.md`, harness defects are filed, not patched
locally). Its own independent live re-check is a bare
`curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${origin}${path_tested}"`
with no credential option at all — it will get HTTP 401 against the walled
beta origin, breaking the live re-check leg of every `browser_deployed_check`
triad assertion across this project, not just this mission's own.

Until that upstream fix lands, the only available workaround is exporting
`BETA_BASIC_AUTH_USER`/`BETA_BASIC_AUTH_PASSWORD` into the gate-running
shell's environment before running a gate that includes a
`browser_deployed_check` assertion against the walled origin. This is a
documented, accepted limitation — not a silent gap.
