# F1: Does Firebase App Hosting expose a CDN purge API?

Read-only investigation, follow-up to the single open question in
`docs/f6-cdn-invalidation-investigation.md`. No code, config, or deploy state was
changed. Written 2026-08-05.

## 1. Verdict

**No programmatic CDN purge/invalidation API exists for Firebase App Hosting.**
Confidence: **high**. This is based on a full enumeration of the public REST API
surface (a Discovery Document, which by definition lists every method a service
exposes) plus the `firebase` CLI's complete `apphosting:*` command list, both checked
directly rather than inferred from blog posts.

What would change this verdict: a private/allowlisted API not present in the public
discovery document (Google sometimes ships these to early-access partners), or a
future product change — worth re-checking if Firebase ships an App Hosting changelog
entry mentioning cache purge. Nothing found during this investigation suggests one
currently exists, even in preview.

## 2. Evidence

### 2a. REST API — full method enumeration

Fetched via Alembic:
- `https://firebase.google.com/docs/reference/apphosting/rest` (human-readable method
  index)
- `https://firebaseapphosting.googleapis.com/$discovery/rest?version=v1` (machine
  discovery document — authoritative, lists every method the service exposes)

Every resource and method on `firebaseapphosting.googleapis.com` v1 and v1beta:

| Resource | Methods |
|---|---|
| `projects.locations` | GET (get, list) |
| `projects.locations.backends` | POST (create), DELETE, GET (get, list), PATCH |
| `projects.locations.backends.builds` | POST (create), DELETE, GET (get, list) |
| `projects.locations.backends.domains` | POST (create), DELETE, GET (get, list), PATCH |
| `projects.locations.backends.rollouts` | POST (create), GET (get, list) |
| `projects.locations.backends.traffic` | GET, PATCH |
| `projects.locations.operations` | POST (:cancel), DELETE, GET (get, list) |

I `grep -i 'purge\|invalidat\|cache'` the entire discovery JSON — the only hit is a
description string on the `Backend.servingLocality` enum (`GLOBAL_ACCESS`) explaining
that App Hosting "replicates your backend's configuration and cached data to
[multiple] POPs and uses a global CDN." That's descriptive prose about how caching
works internally, not an API surface. There is no `purge`, `invalidate`, or `cache`
**resource or method** anywhere in either API version.

### 2b. Firebase's own docs state the CDN config "cannot be modified"

Fetched via Alembic: `https://firebase.google.com/docs/app-hosting/optimize-cache`
(the canonical App Hosting caching doc).

> "Though the basic Cloud CDN configuration is set by App Hosting and cannot be
> modified, there are a number of things you can do to optimize your caching..."

The doc then documents only: which `Cache-Control`/`Age` directives Cloud CDN
respects (full table: `no-store`, `no-cache`, `public`, `private`, `max-age`,
`s-maxage`, `stale-while-revalidate`, `must-revalidate`, `proxy-revalidate`,
`no-transform`), and a Console **graph** ("Cloud CDN - Outgoing Bandwidth") that marks
each rollout — i.e. the only cache-affecting action the doc describes at all is a
rollout, which is a deploy, not a purge call. No purge/invalidation mechanism is
mentioned anywhere on this page. This is consistent with, but does not by itself
prove, the API enumeration in 2a — the "cannot be modified" sentence is about cache
*configuration* (headers/TTLs), not directly about purge actions, so the discovery
document (2a) is the stronger evidence for the verdict, not this sentence alone.

### 2c. `firebase` CLI — full `apphosting:*` command list

Ran `firebase --help 2>&1 | grep -i apphosting` (v15.15.0, logged in as
`brad@inunu.net`, confirmed via `firebase login:list`):

```
apphosting:backends:list
apphosting:backends:create
apphosting:backends:get <backend>
apphosting:backends:delete
apphosting:secrets:set
apphosting:secrets:grantaccess
apphosting:secrets:describe
apphosting:secrets:access
apphosting:rollouts:create <backendId>
```

No `apphosting:cache:*` or `apphosting:*:purge` command family exists. `firebase
apphosting --help` on its own prints only the global option list (no subcommand
group), confirming `apphosting:*` is the complete flat namespace, not a partial view.

### 2d. gcloud / Cloud CDN url-map route — could not test directly, but strong indirect evidence it's a dead end

`gcloud` is **not installed** in this environment (`command not found: gcloud`) — not
merely unauthenticated. I did not attempt an interactive install/login per the
read-only/no-interactive-auth constraint, so I could not directly run
`gcloud compute url-maps list` against project `saoc-webapp`.

However, a read-only, authenticated `firebase apphosting:backends:get saoc-prod
--project saoc-webapp --json` (get, not a mutation) returned:

```json
{
  "servingLocality": "GLOBAL_ACCESS",
  "managedResources": [
    { "runService": { "service": "projects/1003063203247/locations/europe-west4/services/saoc-prod" } }
  ],
  "serviceAccount": "firebase-app-hosting-compute@saoc-webapp.iam.gserviceaccount.com"
}
```

`managedResources` lists exactly one customer-visible resource: the backing Cloud Run
service. No Compute Engine URL map, backend service, or Cloud CDN resource is listed
as a `managedResource` — and the discovery-document description of `GLOBAL_ACCESS`
says App Hosting "uses App Hosting's global-replicated serving infrastructure"
distinct from the backend's parent region, i.e. the CDN/load-balancer layer is
Google-managed infrastructure shared across App Hosting customers, not a per-project
Compute Engine resource the customer's project owns. This makes it very unlikely that
`gcloud compute url-maps list` in project `saoc-webapp` would show anything to
invalidate against, even if gcloud were installed and authenticated — but this is an
**inference from the API's own resource model, not a directly-verified negative**. I
am flagging it as such rather than asserting it as confirmed.

**Not established:** what a live `gcloud compute url-maps list --project saoc-webapp`
would actually return. If Brad wants this closed definitively, installing gcloud
(`brew install google-cloud-sdk`) and running that one read-only list command would
settle it in under a minute — I did not do this because gcloud isn't present and
installing new tooling is outside a read-only investigation's remit without asking
first.

### 2e. `cache-tag` headers — confirmed present, confirmed unusable for purge

Read-only `curl -sI` against the live backend
(`https://saoc-prod--saoc-webapp.europe-west4.hosted.app/about`) reproduced the
headers from the F6 doc:

```
cache-control: s-maxage=31536000
cache-tag: 1003063203247
cache-tag: 1003063203247:saoc-prod
cdn-cache-status: miss
x-fah-adapter: nextjs-14.0.21
x-nextjs-cache: HIT
```

(`cdn-cache-status: miss` here reflects a cold cache slot at request time, not a
contradiction of F6's `hit` observation — both are consistent with normal CDN
behaviour.)

The two `cache-tag` values are exactly `<Firebase project number>` and `<Firebase
project number>:<backend ID>` — i.e., they identify *which backend* served the
response, matching the `GLOBAL_ACCESS` "replicates ... to POPs" description in 2a.
Nothing in the REST API (2a), the CLI (2c), or the caching doc (2b) exposes any way to
purge *by* a cache tag, or any tag-scoped purge concept at all. **Verdict on this
specific sub-question: the `cache-tag` headers are Google-internal routing/debugging
metadata with no corresponding customer-facing purge mechanism — a dead end, not a
lead.** This is a direct, not inferred, finding: the full method list in 2a contains
no method that accepts a cache-tag parameter of any kind.

### 2f. Public domain vs. App Hosting domain (context, not part of the core question)

`https://saoc.co.za/about` currently returns `404` from a plain `nginx` server — this
domain is not yet pointed at the App Hosting backend (separate, already-known fact,
not new). `https://saoc-webapp.web.app/about` returns `404` from Firebase's *classic*
Hosting CDN (Fastly — `x-served-by: cache-jnb7021-JNB`), a different product/cache
layer from App Hosting's Envoy/Cloud-CDN-fronted URL used in the F6 investigation.
Neither of these affects the verdict; the correct test URL remains
`saoc-prod--saoc-webapp.europe-west4.hosted.app`, which is what section 2e used.

## 3. If a purge API existed (not applicable — none found)

N/A per the verdict above.

## 4. Recommended fallback — option 2 from the F6 doc, made concrete

Since no purge API exists, the only two real options are (a) accept bounded
staleness via a shorter `s-maxage` + `stale-while-revalidate`, or (b) full redeploy as
a manual break-glass purge (already documented in F6, not repeated here). This section
makes option (a) concrete.

**Recommended approach:** per-route `export const revalidate = <seconds>` (or
`next.config.js` `headers()` setting `Cache-Control`) on CMS-driven routes, paired
with `stale-while-revalidate` — which section 2b's directive table confirms Cloud CDN
explicitly honors ("served to a client for up to SECONDS while revalidation takes
place asynchronously").

**Concrete recommended TTL:** `s-maxage=60, stale-while-revalidate=300` for
CMS-driven marketing pages.
- **Trade-off in plain words:** a secretary's edit becomes visible to the public
  within **60 seconds** of publishing (worst case — the CDN re-checks origin at most
  once per 60s window), not instantly. Visitors mid-window may still see the old
  version for up to a minute. During the following 5-minute
  `stale-while-revalidate` window, the CDN can keep serving the last-known-good
  cached copy instantly while it revalidates in the background, so this doesn't add
  extra staleness beyond the 60s — it only protects against a slow/failed origin
  revalidation causing a visible delay or error.
- Note `must-revalidate`/`s-maxage` responses are explicitly documented as **not**
  served stale (2b) — `stale-while-revalidate` is the directive that must be present
  for the "serve fast, revalidate in background" behaviour; without it, an origin
  hiccup at exactly the 60s mark would cause a visible slow request instead of a
  stale-but-fast one.

**Which routes get the short TTL:** `/`, `/about`, `/judging`, `/contact`,
`/national-show*`, `/events*`, `/societies*`, `/sponsors`, `/media-kit` — anything
rendering Sanity-sourced content. **Which routes keep the current 1-year default:**
none that are purely static (there don't appear to be any fully static marketing
pages left once CMS wiring is complete — this should be confirmed against F5/M2 scope
before implementing, since it's a judgement call about which pages are CMS-driven,
not something this investigation determined).

**Not recommended:** applying a short TTL blanket-wide, since it increases Cloud Run
origin traffic/cost proportionally to `1/s-maxage` for every route it touches — scope
it to CMS-driven routes only, per F6's original note.

## 5. Cost / risk of each option

| Option | Cost | Risk |
|---|---|---|
| Shorter `s-maxage` + `stale-while-revalidate` (recommended) | More Cloud Run origin hits (bounded by `1/60s` per unique cached URL, not per visitor) — negligible at SAOC's traffic scale; `minInstances: 0` in `apphosting.yaml` means occasional cold starts on origin re-checks, already true today. | Low. Standard, documented Next.js + Firebase mechanism (2b). No code beyond a `revalidate` export or `headers()` block. |
| Full redeploy as manual purge (F6's option 3, unchanged by this investigation) | Requires a developer/CI run per content edit that needs to go live immediately. | Low technical risk, but defeats the "secretary edits without a developer" goal — a process/ownership cost, not a technical one. |
| Wait for a future Firebase purge API | Zero cost today. | Speculative — no signal found (no changelog entry, no beta flag, no discovery-doc placeholder) that one is coming. Do not plan around this. |

## Explicitly not done

No code was changed. No config was changed. No deploy was triggered. No CDN, backend,
traffic, or App Hosting settings were modified — every `firebase apphosting:*` command
run was a `:get` (read). `gcloud` was not installed. No secret values were printed,
logged, or echoed.
