# Sanity Free-Plan Limits Assessment

**Date:** 2026-07-28
**Author:** @analyst via Athanor chain

## Background

SAOC's Sanity project auto-downgraded to the Free plan when the Growth trial ended (email 2026-07-14). Plan downgrade confirmed: `maxRetentionDays: 3` matches the Free tier. This assessment checks current usage against Free-plan limits.

## Limits vs. current usage

| Limit (Free plan) | Cap | Current usage | Status |
|---|---|---|---|
| Datasets | 2 | 1 (production) — measured | OK |
| Documents | 10,000 | 94 (GROQ `count(*[])`) — measured | OK |
| User seats | 20 | 4 members (1 human + 3 robot tokens) — measured | OK |
| Permission roles | 2 assignable | admin/editor/viewer displayed — needs dashboard verify | WATCH |
| GROQ webhooks | 2 | not queried | UNKNOWN |
| API CDN req/month | 1,000,000 | unmeasured; prod reads use CDN (`sanity/lib/client.ts:17`) | Est. OK |
| API req/month | 250,000 | unmeasured; only draft-mode bypasses CDN | Est. OK |
| Assets storage | 100GB | not queried | UNKNOWN |
| Bandwidth/month | 100GB | unmeasured | Est. OK |
| Unique attrs/dataset | 2,000 | not queried | UNKNOWN |

## Data-access note

The Sanity Management API has no usage/quota endpoint reachable with a project token — `/usage` and `/limits` both return 404. Real usage totals are only visible on the manage.sanity.io dashboard.

## GROQ cron estimate

`.github/workflows/refresh-llms.yml` runs nightly (`0 2 * * *`); `scripts/refresh-llms.ts` makes 4 `client.fetch` calls per run, which works out to roughly 120 API requests/month — about 0.05% of the API request cap. Negligible.

## Architecture note

`sanity/lib/fetch.ts:29-33` uses Next.js cache tags with `useCdn` for published reads, so site traffic hits the 1M CDN-request quota, deduped by the Next.js data cache.

## Flags

Nothing measured is within 2x of its cap, and nothing has breached a limit. The unknowns (webhooks, asset storage, unique attributes) need a manual dashboard check — tracked as a backlog follow-up.

## Verdict

**OK.** No action required beyond the manual dashboard spot-check logged in the backlog.
