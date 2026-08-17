---
description: Fetch a URL via Alembic proxy — returns clean Markdown for LLM pipelines. Use this instead of WebFetch for any known URL retrieval.
alembic_version: 1.68.0
---

# /alembic

Fetch and distill web content through the Alembic proxy at `localhost:7077`. Returns clean Markdown with ~84-98% token reduction. Also does PDF extraction, docs-platform adapters, hydration-state extraction, a Camoufox stealth escalation path, confidence signalling, and batch fetching — see below. No alembic installation required in your workspace.

## Quickstart

```bash
curl -s http://localhost:7077/<url>                                    # Markdown
curl -s -H "Accept: application/json" http://localhost:7077/<url>      # JSON + metadata
curl -s "http://localhost:7077/<url>?js=true"                          # force JS render
curl -s "http://localhost:7077/<url>?no_cache=true"                    # bypass cache
```

Use Alembic for all URL retrieval instead of WebFetch. WebSearch (discovery) is exempt.

## Endpoints

- `GET /<url>` — catch-all distill, e.g. `http://localhost:7077/https://example.com`.
- `GET /?q=<query>` — search mode.
- `GET /` with `Accept: application/json` — health/status JSON (version, config, cascade order, stats).
- `GET /metrics` — Prometheus metrics.
- `POST /batch` — distill up to 10 URLs in parallel; body `{"urls": [...], "format": "markdown"|"json"|"text", "no_cache": bool}`.
- `POST /cache/vacuum` — remove only expired cache entries; live entries untouched.
- `DELETE /cache` — clear the entire cache.
- `DELETE /cache/<url>` — evict one cached URL.
- `GET /stats` — request stats JSON.

## Query params & request headers

Query params: `q` (search), `js` (force JS render), `auto_js` (`false` disables server-side auto-escalation, default enabled), `saas` (name a SaaS render backend instead of local Playwright/Camoufox), `no_cache`, `jq` (jmespath filter on JSON responses), `num`/`backend`/`time_range`/`fetch` (search-mode only: result count, backend selection, time filter, inline-fetch each result).

Request headers (JS-rendered requests only): `x-alembic-localstorage` / `x-alembic-sessionstorage` (`key=value` injected before fetch), `x-alembic-jq` (same as `?jq=`), `x-alembic-wait-for` (CSS selector to await; implicitly forces JS mode), `x-alembic-grace-ms` (post-render grace period, clamped 0-30000), `x-alembic-scroll` (scroll to bottom before extracting, for lazy-loaded content).

## Response headers worth reading

`X-Alembic-Strategy` (which cascade stage produced the content), `X-Alembic-Confidence` / `X-Alembic-Confidence-Reasons` (see Confidence section below), `X-Alembic-Blocked` / `X-Alembic-Blocked-By` (bot-wall/interstitial detection), `X-Alembic-Retry` (a second persona was auto-tried after a block and succeeded), `X-Alembic-JS-Hint-Score` (0-10; >=6 suggests retrying with `?js=true`), `X-Alembic-Quality-Score` (0-100 heuristic), `X-Alembic-Cached`, `X-Alembic-Original-Tokens` / `X-Alembic-Clean-Tokens`. 25 response headers exist in total (title, author, date, language, word/link counts, search backend/count, etc.) — full table in `docs/API.md` in the Alembic repository.

## Capability areas

- **PDF extraction** — text-based PDFs are extracted via pypdf (`pdf-text`); encrypted/scanned/oversized PDFs get a dedicated `pdf-unsupported` result rather than a silent failure.
- **Docs-platform adapters** — a registry-driven adapter tier (currently Stoplight) fetches structured content directly from a docs platform's own JSON API instead of extracting hydrated HTML, for SPA doc sites whose article body isn't in the raw page.
- **Hydration-state extraction** — pre-rendered content is pulled from client-side SSR state blobs (Next.js, Nuxt 3, Remix) without needing a JS-rendering browser at all.
- **Camoufox stealth engine** — when a page is blocked or scores very low quality, and `ALEMBIC_STEALTH=1` + `proxy_url` are configured, Alembic retries the fetch through a stealth browser (Patchright) and re-runs extraction against the freshly rendered HTML.
- **Confidence signalling** — every result carries a post-hoc high/medium/low confidence classification with machine-readable reason codes. See the dedicated section below — read it before trusting a low-confidence result.
- **Batch endpoint** — `POST /batch` distills up to 10 URLs in one parallel request.

## Extraction cascade & strategies

Routing runs in shape order: pre-cascade short-circuits (binary/PDF/SVG/sitemap/arXiv/docs-adapter/RSS/plain-text/JSON routing) → structured page-type adapters → `llms.txt` → general-purpose extractors → deterministic fallback → post-cascade stealth retry. The real pipeline is considerably larger than any stage count quoted elsewhere.

Representative strategy values (29 exist total; the ones below are the ones worth recognizing because they change what to do next): `adapter:stoplight` (docs-platform adapter hit), `hydration-next` (SSR state blob, no rendering needed), `llms.txt` (site-published pre-cleaned index), `json-ld` (structured-data articleBody), `trafilatura` / `readability` / `fallback` (general-purpose extractors, decreasing quality), `pdf-text` (PDF extraction succeeded), `stealth-patchright` (stealth-browser retry succeeded). Seeing `trafilatura`, `readability`, or `fit-cleaner` all mean the same thing — text extraction succeeded — the specific literal is not actionable on its own. For the full 29-value list, treat `capability-inventory.yaml` in the Alembic project repo as ground truth, not any prose table.

## Confidence: reading the result and deciding what to do

Levels: `high` (nothing fired), `medium` (a soft reason fired), `low` (a hard reason fired — treat as unreliable by default).

| reason code | action |
|---|---|
| `upstream_error_status` | origin returned an HTTP error; do not use this content, check the URL before you retry |
| `error_page_pattern` | content matched a known error phrase; discard it, don't treat it as the page |
| `og_description_stub` | fell back to a meta-description stub; retry with `js=true`, escalate to stealth if still stub-only |
| `below_token_floor` | content is implausibly short for its strategy — this is the Ozow failure by name (232 bytes trusted as the full document); retry with `js=true`, escalate to stealth if still short |
| `low_quality_score` | heuristic quality score is low; retry with `js=true`; if `X-Alembic-Blocked` is also set and quality is still low after that retry, that's the trigger to consider the stealth engine (`ALEMBIC_STEALTH=1`) |
| `below_medium_quality_threshold` | soft miss, `medium` confidence; usable, but retry if the task is high-stakes |
| `below_medium_token_floor` | soft miss, `medium` confidence; usable with caution, retry if high-stakes |

**Do not trust a `low`-confidence result as the real page content** under any of `upstream_error_status`, `error_page_pattern`, `og_description_stub`, `below_token_floor`, or `low_quality_score` unless a `js=true` retry succeeded, or the user has explicitly accepted a degraded result for the task. A short, LOW-confidence body is signal that the fetch failed, not a smaller version of the real page — don't summarize it, quote it, or act on it as if it were.

## If Alembic is down

Alembic runs as an always-on launchd service — you should not need to start it manually. Confirm it's alive with a health check:

```bash
curl -s http://localhost:7077/
# Should return a banner: "Alembic Proxy vX.Y.Z" with a short usage summary
```

If `localhost:7077` stops answering, restart the launchd-managed daemon (no chat session required):

```bash
launchctl kickstart -k "gui/$(id -u)/net.inunu.alembic-proxy"
```

Search mode (`GET /?q=`) requires a search backend — set `ALEMBIC_SEARXNG_URL` or `BRAVE_SEARCH_API_KEY` in `.env`, otherwise it returns HTTP 503. URL fetching needs no configuration.
