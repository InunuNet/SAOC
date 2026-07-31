# F6 CDN invalidation investigation

Read-only diagnosis, `cms-activation-deploy` mission, follow-up to F6's finding that a
confirmed Studio publish + a confirmed 200 from `/api/revalidate` never reaches the
deployed public site. No code, config, or deploy state was changed while producing
this document — every command below is a read (curl GET, local `grep`/`find`, and web
research via Alembic). Written 2026-07-30.

## Bottom line

**This is not a bug, a version mismatch, or an adapter defect — it is Next.js's own
documented behaviour, and our `/api/revalidate` route is missing a step Next.js's
official docs say is required.** Next.js's App Router CDN-caching guide states this in
almost the exact words needed to explain what we observed:

> "CDN-level caching alone does not support on-demand revalidation
> (`revalidateTag()`/`revalidatePath()`): those calls invalidate the Next.js server
> cache, but the CDN will continue serving its cached copy until the `s-maxage` TTL
> expires. To propagate on-demand revalidation to the CDN, trigger CDN purges
> alongside your revalidation call."
>
> — [nextjs.org/docs/app/guides/cdn-caching](https://nextjs.org/docs/app/guides/cdn-caching)

`app/api/revalidate/route.ts` calls `revalidateTag('sanity', 'max')` and, if the
payload has a `_type`, `revalidateTag(body._type, 'max')` — and stops there. It never
calls a CDN purge API. That is the entire gap. Confidence: **high** — this is primary-
source documentation from the framework itself, matched line-for-line against our own
observed symptoms (see "Fit against observed evidence" below), not an inference chain.

## What was already established (F6, not re-derived here)

- Studio publish writes to the dataset immediately (confirmed via authoritative
  Content Lake read).
- `POST /api/revalidate` with the correct secret returns `200
  {"ok":true,"revalidated":true}`.
- The live `/about` page never reflected a published change across a 120s poll.
- Response headers during that poll: `cdn-cache-status: hit`,
  `cache-control: s-maxage=31536000`, `x-nextjs-cache: HIT` (briefly `STALE`
  immediately after a revalidate call, per team-lead's independent repro), `age`
  climbing monotonically the entire time — i.e. the identical cached object served on
  every request, never re-checked against origin.

## Fit against observed evidence

Every observed symptom matches the documented behaviour exactly, with no residual
unexplained gap:

| Observed | Explained by |
|---|---|
| `x-nextjs-cache: STALE` immediately after revalidate | `revalidateTag()` genuinely invalidates Next's own server-side cache — this is real and working, exactly as documented ("those calls invalidate the Next.js server cache"). |
| `cdn-cache-status: hit` on the very next request, `age` still climbing | The CDN "will continue serving its cached copy until the `s-maxage` TTL expires" — no purge call was made, so nothing tells the CDN to re-check. |
| `cache-control: s-maxage=31536000` (exactly one year) | Documented Next.js default: "**Static pages** (no revalidation): `s-maxage=31536000` (one year)." Confirmed via `grep -rn "export const revalidate" app/` — zero results anywhere in the app, so every CMS-driven page falls into this default, relying entirely on on-demand revalidation to ever change. This is intentional, standard App Router usage for content that changes only via CMS publish, not a misconfiguration. |
| `/api/revalidate` returns 200 but doesn't fix it | The route does exactly what Next.js says `revalidateTag()`/`revalidatePath()` do and nothing more — no CDN purge call exists in `app/api/revalidate/route.ts` (read directly; the entire handler is `revalidateTag('sanity', 'max')` + conditionally `revalidateTag(body._type, 'max')`, then a 200 response). |

Firebase's own official docs for this exact hosting product independently corroborate
the other half of the picture — [Cache app content \| Firebase App
Hosting](https://firebase.google.com/docs/app-hosting/optimize-cache) documents
**only** static `Cache-Control` header tuning (`max-age`, `s-maxage`,
`stale-while-revalidate`, `private`, `no-store`, etc., set either implicitly by
Next.js or via `next.config.js` `headers()`). It does not mention `revalidateTag()`,
on-demand ISR, or any API for purging Cloud CDN from application code. The one purge
mechanism the wider Firebase docs describe is a full **redeploy** ("Firebase Hosting
automatically invalidates the CDN cache when you deploy new content" —
[Manage cache behavior \| Firebase
Hosting](https://firebase.google.com/docs/hosting/manage-cache); a Firebase engineer
blog post about App Hosting similarly notes "the CDN tags will be purged on every new
rollout" in the context of static assets — [What web frameworks does Firebase App
Hosting support?](https://firebase.blog/posts/2025/06/app-hosting-frameworks/)). A
live Vercel/Next.js GitHub discussion (
[#57263, "Add cache tags to response headers"](https://github.com/vercel/next.js/discussions/57263)
) confirms this is a known, general gap for **any** CDN-fronted Next.js self-hosting
setup, not specific to Firebase: "Without this it's not possible to implement on
demand ISR and revalidation if self hosting behind a caching CDN."

## The `x-fah-adapter: nextjs-14.0.21` lead — tested, not confirmed, now de-prioritised

This response header was flagged in the F6 contract as "a hypothesis to test, not a
conclusion," precisely because of last night's cost from an unverified inference on
the secret bug. Having now found a documented, evidence-complete explanation that
requires no version mismatch at all, this lead is **downgraded, not eliminated**:

- **Against it being the cause:** if the adapter genuinely didn't understand Next
  16's cache handlers, the failure mode would more plausibly be broader than "CDN
  purge specifically missing" — F2 already proved Next 16-specific features
  (`useEffectEvent` in the Studio, the hydration fix) work correctly on this exact
  deployment. A documented, general, platform-independent gap (no CDN purge call in
  our own code) fully explains the symptom without needing an adapter defect at all —
  Occam's razor favours the simpler, evidenced explanation.
- **Still open:** what `x-fah-adapter` actually denotes (the adapter package's own
  version vs. some Next-compatibility-target string) was not established with
  certainty — no official doc surfaced during this investigation that defines this
  specific header. It remains a legitimate loose end, just not the leading
  explanation anymore.
- **What would confirm or refute it as relevant:** if a manual CDN purge (e.g. a new
  rollout) makes the loop work correctly exactly once, then a subsequent
  publish-without-manual-purge fails again in the same way — that would be fully
  consistent with the missing-purge-call explanation and would not implicate the
  adapter at all. If, conversely, purging manually does NOT make even that one
  post-purge request reflect the new content correctly, that would point back toward
  something adapter/version-specific and this header would be worth escalating to
  Firebase support with the exact adapter version string.

## Recommended fix

Add an explicit CDN purge call to `app/api/revalidate/route.ts`, alongside the
existing `revalidateTag()` calls, exactly as Next.js's own guide recommends ("trigger
CDN purges alongside your revalidation call"). Two sub-options, in order of
preference — **neither was implemented or tested; this is a recommendation for Brad's
decision, not a change made tonight**:

1. **If Firebase App Hosting exposes a CDN/cache purge API** (REST endpoint or
   `firebase` CLI command) that can be called for the App Hosting backend or a
   specific path — this investigation did **not** find one documented for App Hosting
   specifically (as distinct from classic Firebase Hosting + Cloud Functions, which
   does document a `curl -X PURGE <url>` pattern gated behind a paid plan — see
   [Stack Overflow: Firebase hosting with cloud functions - how to purge/refresh CDN
   cache](https://stackoverflow.com/questions/52787090/firebase-hosting-with-cloud-functions-how-to-purge-refresh-cdn-cache)
   and
   [Stack Overflow: Firebase Hosting how to programmatically or manually flush the
   cache?](https://stackoverflow.com/questions/77483986/firebase-hosting-how-to-programmatically-or-manually-flush-the-cache)).
   Whether the equivalent exists for App Hosting's underlying Cloud Run + Cloud CDN
   setup (e.g. a direct Cloud CDN invalidation call via `gcloud compute url-maps
   invalidate-cdn-cache`, if App Hosting's CDN resource is reachable that way despite
   the "cannot be modified" language in Firebase's own docs) needs a follow-up
   investigation with `gcloud`/Cloud Console access this session didn't have reason
   to use for a read-only task — **flagging as the single most valuable next
   investigation step**, since it would let the revalidate route stay tag-precise
   (only purging the affected page) rather than time-based.
   - *Risk if it exists and is added correctly:* low — this is exactly the pattern
     Next.js's own docs prescribe.
   - *Risk if no such API exists:* the fix collapses to option 2.

2. **Reduce `s-maxage` for CMS-driven routes** via `next.config.js`'s `headers()`
   override (the mechanism Firebase's own App Hosting cache doc documents), or a
   per-route `export const revalidate = <seconds>` (Next's own time-based ISR knob),
   with a `stale-while-revalidate` window so the CDN still serves fast responses but
   re-checks with origin on a bounded schedule instead of never.
   - *Trade-off:* this does **not** make edits instant — a secretary's edit would
     still take up to the new TTL to appear (e.g. 60s, 5 minutes — Brad's call on the
     freshness/performance trade-off), rather than the near-immediate propagation the
     mission originally wanted to prove. It is a **workaround**, not a fix for
     "publish and it's live," and should be described to Brad as such rather than as
     a full resolution.
   - *Risk:* low, well-documented Next.js/Firebase mechanism, but changes caching
     behaviour for every CMS-driven route it's applied to — worth scoping deliberately
     (e.g. apply only to `/about`, `/`, `/judging`, `/contact`, `/national-show` once
     that page is wired, not blanket-applied to static asset routes which should keep
     their long TTLs).

3. **Full redeploy as a manual "break glass" purge** — confirmed pattern for Firebase
   Hosting generally ("a Hosting deploy [is] an 'emergency' lever that will
   invalidate the whole cache if you need it" — Firebase engineer, Google Groups
   thread linked above). Works today, requires no code change, but means every
   content edit needs an engineer to trigger a deploy — defeats the mission's actual
   goal (secretary edits, no developer involved) and should be described to Brad as a
   stopgap only, not a solution.

## What would discriminate between the fix options

- Whether Firebase App Hosting exposes any programmatic CDN purge surface at all
  (option 1) is the single fact that would most change the recommendation — it's the
  only option that fully satisfies "publish and it's live quickly" without a
  freshness trade-off. This needs someone with `gcloud`/gcp Console access to check
  the App Hosting backend's underlying Cloud Run/Cloud CDN resources, and/or a support
  ticket to Firebase asking directly. Not something Alembic web search settled with
  confidence — official docs are silent on it for App Hosting specifically.
- If option 1 doesn't exist, the decision becomes purely Brad's trade-off call between
  option 2 (bounded staleness, e.g. "edits appear within 60 seconds," automatic, no
  developer involvement) and option 3 (instant but requires a developer to deploy).

## Explicitly not done

No code was changed. No config was changed. No deploy was triggered. No CDN or App
Hosting settings were modified. This document does not implement a fix — it exists so
Brad has a cause and ranked options in the morning, not just the symptom F6 already
reported.
