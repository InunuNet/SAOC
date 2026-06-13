# SAOC Hosting Platform Research

**Date:** 2026-06-13  
**Constraints:**
- Private GitHub repo (InunuNet/SAOC)
- South African audience — Johannesburg or Cape Town PoP preferred
- Non-profit budget — free tier or minimal cost
- Next.js 15 App Router + SSR (not static only)
- Auto-deploy on push to main

---

## Comparison Table

| Platform | SA PoP | SSR Support | Free Tier | Auto-Deploy | Notes |
|----------|--------|-------------|-----------|-------------|-------|
| **Firebase App Hosting** ⬅ current | ❌ No SA region. Closest: europe-west4 (NL). CDN serves static globally. | ✅ Full Next.js 15 App Router, GA April 2025 | ⚠️ Blaze (pay-as-you-go) required; generous free quotas | ✅ GitHub integration native | Already configured in project |
| **Fly.io** | ✅ `jnb` Johannesburg — Operational | ✅ Full Node.js container, any framework | ⚠️ No always-free tier; ~$5–10/mo for small app | ✅ GitHub Actions deploy | Best SA latency for SSR |
| **Cloudflare Pages** | ✅ Global edge including Africa | ⚠️ Requires OpenNext adapter; edge-runtime only; ISR not supported | ✅ Free tier generous | ✅ Git push deploy | Significant refactor needed; loses some App Router features |
| **Railway** | ❌ US West/East, EU West, SE Asia only. No Africa. | ✅ Full Node.js | ❌ No free tier (paid plans only, ~$5/mo) | ✅ GitHub auto-deploy | No SA benefit; costs money |
| **Render** | ❌ US/EU only | ✅ Full Node.js | ⚠️ Free tier: 30–60s cold starts, spins down after 15 min inactivity | ✅ GitHub auto-deploy | Cold starts make free tier unusable for SSR |
| **Netlify** | ✅ Cape Town CDN (paid High-Perf tier only; free tier routes poorly to SA) | ⚠️ OpenNext adapter required for full SSR | ✅ Free tier for static; SSR limited on free | ✅ GitHub auto-deploy | SA CDN behind paid tier; SSR adapter needed |
| **DigitalOcean App Platform** | ❌ US/EU/Asia only | ✅ Full Next.js SSR supported | ⚠️ Free tier for static sites; SSR requires paid ($5/mo) | ✅ GitHub auto-deploy | No SA value-add |
| **AWS Amplify** | ⚠️ AWS has af-south-1 (Cape Town) but Amplify CLI reportedly missing this region | ✅ Next.js 12–15 SSR supported | ⚠️ No free tier; pay-as-you-go | ✅ GitHub auto-deploy | SA region not confirmed in Amplify; complex setup |
| **Coolify (self-host)** | ✅ Could deploy on any VPS with SA DC (Hetzner Cloud has JNB) | ✅ Any framework | ✅ Free software; VPS cost ~$5–10/mo | ✅ GitHub webhook | Requires VPS maintenance; not turn-key |

---

## Verdict

### Stay on Firebase App Hosting (Recommended)

**Why:** Already fully configured and battle-tested in this project. The SAOC site is a low-traffic non-profit site — the ~150–200ms SSR latency from europe-west4 is imperceptible to users, and static/cached pages (which is 90%+ of site content) are served from Google's global CDN with SA edge nodes. Migration to any other platform would cost 2–4 hours of engineering time with no meaningful user-visible benefit.

**Cost:** Blaze plan is pay-as-you-go but has a generous free tier. A site of this scale (a few hundred visitors/month) should cost **$0/month** under the free quotas.

**Risk:** None. Firebase App Hosting went GA in April 2025. InunuNet account already set up.

---

### If SA SSR latency becomes a priority later: Fly.io

Fly.io has a verified Johannesburg (`jnb`) region with full Node.js container support. If the site scales or SSR latency becomes a real user complaint, Fly.io is the cleanest migration path (~$5–10/mo for a small app). The migration would involve:
1. Adding a `Dockerfile` (Next.js standalone build)
2. Setting up `fly.toml` with `jnb` region
3. Moving env vars to Fly secrets
4. Adding a GitHub Actions deploy workflow

---

## Platforms Ruled Out

| Platform | Reason |
|----------|--------|
| Cloudflare Pages | Requires OpenNext refactor, loses ISR + some App Router features, edge-runtime only |
| Railway | No SA region, no free tier, history of EU West outages (Dec 2025) |
| Render | Free tier unusable (60s cold starts); no SA region |
| Netlify | SA CDN only on paid tier; poor SA routing on free; SSR adapter required |
| DigitalOcean | No SA region; no free tier for SSR |
| AWS Amplify | SA region unconfirmed in Amplify CLI; overkill complexity for a non-profit site |
| Coolify | Requires ongoing VPS maintenance — wrong for a non-profit council |
