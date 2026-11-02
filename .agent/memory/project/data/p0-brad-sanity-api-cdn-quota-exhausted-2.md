# p0-brad-sanity-api-cdn-quota-exhausted-2

**P0/BRAD — Sanity API CDN quota exhausted** (2026-10-28 05:20 SAST) — apicdn returns 402 plan_limit_reached ("API CDN Requests quota limit reached"); site falls back to the uncached API (200 today). If the API request quota is also hit, every Sanity-backed page loses content. Needs Brad: Sanity plan upgrade (money) or quota reset date; engineering follow-up: cut request volume (ISR/revalidate tuning, fewer per-render fetches, check-script traffic against the dataset). Probe: node --env-file=.env.local .tmp/sandbox/ops/sanity-cdn-probe.mjs
