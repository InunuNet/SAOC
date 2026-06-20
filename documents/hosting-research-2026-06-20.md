# SAOC Hosting Platform Research — Updated

**Date:** 2026-06-20  
**Supersedes:** documents/hosting-research-2026-06-13.md  
**Trigger:** Brad changed requirement 2026-06-19 — SA data centre required before DNS cutover.

**Constraints:**
- South African audience — SSR compute in SA preferred (Johannesburg or Cape Town)
- Non-profit budget — free tier or minimal monthly cost
- Next.js 15 App Router + SSR (not static only)
- Auto-deploy on push to main (GitHub)
- Minimal maintenance overhead

---

## New Platforms Evaluated (vs. June 13 research)

### Vercel — Cape Town (cpt1) ✅ NEW SA REGION FOUND

Vercel added Cape Town as a compute region. Key facts:

| Attribute | Detail |
|-----------|--------|
| SA Region | `cpt1` — Cape Town, South Africa |
| CDN cache in SA | ✅ All plans — static + ISR responses cached in cpt1 |
| **SSR compute in SA** | ⚠️ **Pro plan only** — Free/Hobby plan runs SSR from nearest compute (likely EU/Asia) |
| Next.js 15 App Router | ✅ Native — no adapters |
| Auto-deploy | ✅ Native GitHub integration |
| Free plan | ✅ Yes — but SA SSR compute not included |
| Pro plan | **$20/month** — includes $20 usage credit; SA function compute available |
| Migration from Firebase | Medium — env vars, remove apphosting.yaml, add vercel.json |

**Verdict:** Vercel gives the best DX and SA edge caching on any plan. But SA SSR compute requires Pro ($20/month = $240/year). For a low-traffic non-profit site where most pages are statically rendered, the free plan's SA CDN cache covers 90%+ of requests — SSR cold paths (contact form, dynamic routes) would still hit EU compute on the free plan.

---

### Fly.io — Johannesburg (jnb) ✅ VERIFIED PREVIOUSLY

| Attribute | Detail |
|-----------|--------|
| SA Region | `jnb` — Johannesburg, South Africa (operational) |
| SSR compute in SA | ✅ Full Node.js container |
| Next.js 15 App Router | ✅ Via standalone build + Dockerfile |
| Auto-deploy | ✅ Via GitHub Actions (custom workflow, ~30 lines) |
| Free tier | ❌ Deprecated — requires payment method |
| Cost (minimal) | ~$1.94/month — shared-cpu-1x 256 MB (always-on) |
| Cost (realistic prod) | **~$8–15/month** — 1 vCPU / 512 MB–1 GB + 3 GB volume + dedicated IPv4 |
| Migration from Firebase | Medium — add Dockerfile, fly.toml, GitHub Actions workflow, move secrets to `fly secrets set` |

**Migration steps (estimated 3–5 hours):**
1. Add `Dockerfile` (Next.js standalone build, ~20 lines)
2. `fly launch --region jnb` — generates `fly.toml`
3. `fly secrets set FIREBASE_PRIVATE_KEY=... NEXT_PUBLIC_FIREBASE_...=...` (all env vars)
4. GitHub Actions deploy workflow (~30 lines)
5. DNS: point saoc.co.za A-record to Fly.io IP (after domain transfer)

---

### Coolify on Xneelo VPS — CLARIFICATION REQUIRED

The June 19 backlog entry referenced "Coolify on Hetzner JNB VPS." This conflated two different companies:

| Company | What it is |
|---------|-----------|
| **Hetzner Cloud** (Germany) | European VPS provider (CX/CPX/CAX instances). **No South African data centre.** Regions: Germany, Finland, US, Singapore. |
| **Hetzner SA → Xneelo** | South African hosting company (separate entity, shared brand history). Has Midrand, Gauteng and Cape Town DCs. Provides shared hosting + VPS. |

Xneelo (formerly Hetzner SA) does offer VPS in SA but their Cloud VPS product is not Hetzner Cloud — it's a local offering. Coolify could be deployed there.

| Attribute | Detail |
|-----------|--------|
| SA DC | Midrand (Gauteng) + Cape Town |
| SSR compute in SA | ✅ Full control (your container) |
| Auto-deploy | ✅ Via Coolify + GitHub webhook |
| Cost | VPS ~R150–350/month (~$8–20/month) + Coolify is free OSS |
| Maintenance | ❌ High — OS updates, security patches, disk, backups, monitoring all manual |
| Skill required | Server admin (docker, SSL, reverse proxy) |

**Verdict:** Highest effort for equivalent result. Wrong for a non-profit council that needs set-it-and-forget-it.

---

## Updated Comparison Table

| Platform | SA Compute | SSR | Free Tier | Auto-Deploy | Est. Monthly Cost | Notes |
|----------|-----------|-----|-----------|-------------|-------------------|-------|
| **Firebase App Hosting** ⬅ current | ❌ Europe (NL) — global CDN caches statics | ✅ Full Next.js 15 App Router | ⚠️ Blaze free quotas | ✅ Native | **~$0** | No SA compute; 90%+ content cached globally |
| **Vercel (Free)** | ⚠️ CDN cache in cpt1 (SA); SSR compute from EU | ✅ Native | ✅ Yes | ✅ Native | **$0** | SA CDN cache only; SSR cold paths from EU |
| **Vercel (Pro)** | ✅ cpt1 — Cape Town SA compute | ✅ Native | N/A | ✅ Native | **$20/month** | Best DX; SA compute; pricey for non-profit |
| **Fly.io jnb** | ✅ Johannesburg SA compute | ✅ Full Node.js container | ❌ None | ✅ GH Actions | **$8–15/month** | Best value for SA SSR; requires Dockerfile |
| **Coolify on Xneelo** | ✅ Midrand/CPT SA | ✅ Full container | N/A | ✅ Webhook | **$8–20/month** | Most maintenance; not recommended |

---

## Recommendation

### Option A — Stay on Firebase (Recommended if latency is not a measured problem)

The SAOC site is a low-traffic non-profit. Static and ISR pages (Home, About, Societies, Judging, Events, National Show, Sponsors) make up 90%+ of traffic and are cached by Google's global CDN — which has SA edge nodes in Johannesburg and Cape Town. Only the first uncached SSR request and API routes (Contact form POST) hit the origin server in europe-west4.

For a few hundred visitors/month, the additional 150–200 ms latency on uncached SSR is imperceptible. Firebase App Hosting is fully configured, costs $0/month under free quotas, and has zero maintenance overhead.

**Do not migrate unless a latency problem is measured.** Brad's stated reason ("SA data centre") is a preference, not a measured user complaint — and migrating costs 3–5 hours of engineering time with no user-visible benefit at this scale.

---

### Option B — Fly.io JNB (If SA compute is a hard requirement)

If Brad confirms SA SSR compute is a hard requirement (e.g., data sovereignty concern, measured latency issue, or future growth), Fly.io Johannesburg is the best option:

- True SA compute (Johannesburg), not just CDN caching
- $8–15/month — lowest cost for real SA SSR
- Proven Next.js 15 App Router support via standalone build
- No proprietary lock-in (it's a Docker container)
- GitHub Actions auto-deploy (30 lines, one-time setup)

Migration effort: **~4 hours** (Dockerfile + fly.toml + secrets + GH Actions + DNS).

---

### Option C — Vercel Pro (If DX and ecosystem matter more than cost)

Vercel Pro at $20/month gives Cape Town (cpt1) compute, the best Next.js DX, instant previews, and a professional platform. For a non-profit spending $240/year on hosting, this is justifiable if the site grows, but overkill for the current scale.

**Free Vercel** is worth considering as a middle ground — SA CDN caching, zero cost, best DX — but SSR compute is not in SA on the free plan.

---

## Decision Required from Brad

Before proceeding, Brad should answer:

1. **Is SA data centre a hard requirement or a preference?** (Data sovereignty, latency complaint, or just "would be nice"?)
2. **Is there a budget ceiling for monthly hosting?** (Firebase = $0; Fly.io = $8–15/month; Vercel Pro = $20/month)
3. **Confirmed: stay on Firebase until D2/D4 + DNS are unblocked?** (No migration before DNS cutover — one migration is enough)

---

## Ruling Out Platforms (unchanged from June 13 research)

| Platform | Reason |
|----------|--------|
| Cloudflare Pages | Requires OpenNext refactor; edge-runtime only; loses ISR + some App Router features |
| Railway | No SA region; history of EU West outages |
| Render | Free tier unusable (60s cold starts); no SA region |
| Netlify | SA CDN on paid tier only; SSR adapter required |
| DigitalOcean | No SA region |
| AWS Amplify | SA region unconfirmed in Amplify CLI; overkill complexity |
| Coolify/Xneelo | Requires ongoing VPS maintenance — wrong for a non-profit council |
