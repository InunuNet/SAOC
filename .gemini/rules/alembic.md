---
description: Mandatory Alembic usage rule — all URL fetching and web search must go through Alembic proxy.
---

# Alembic — Mandatory URL Fetching & Search Rule

## ⛔ NEVER fetch a URL directly. Always use Alembic. No exceptions.

Alembic v1.4.0 is a local HTTP proxy and web search tool at `http://localhost:7077`. It distills raw HTML into clean LLM-ready Markdown via an 8-stage extraction cascade (84–98% token reduction) and searches the web via Brave Search with optional synthesis. This is an active project we are developing — every use validates it and surfaces bugs.

---

## How to Use

```bash
# Health check
curl -s http://localhost:7077/
# Expected: Alembic Proxy v1.0

# Fetch any URL — returns clean Markdown
curl -s http://localhost:7077/https://example.com

# With savings stats
alembic fetch https://example.com --stats

# JSON response with full metadata (strategy, page type, author, date, token counts)
curl -s -H "Accept: application/json" http://localhost:7077/https://example.com

# Batch fetch multiple URLs
alembic batch https://url1.com https://url2.com --concurrency 5

# Web search — returns result list (Brave Search)
curl "http://localhost:7077/?q=python+async+patterns"

# Web search + distill + synthesize top pages into one answer
curl "http://localhost:7077/?q=best+LLM+agent+patterns&fetch=true"
alembic search "query here"
alembic search "query here" --fetch
```

---

## How Alembic Works (8-Stage Cascade)

Alembic tries these in order, stopping at the first that produces clean content:

| Stage | Strategy | What it handles |
|-------|----------|----------------|
| 0 | **Page-type adapters** | Recipes, forums, products — specialized parsers |
| 1 | **`llms.txt` discovery** | Sites with pre-built LLM index — zero extraction, author-curated |
| 1.5 | **Hydration extraction** | Next.js `__NEXT_DATA__`, Nuxt 3, Remix — SSR state without Playwright |
| 1.8 | **JSON-LD `articleBody`** | Articles with structured data embedding |
| 2 | **Content negotiation** | Servers returning `text/markdown` natively |
| 3 | **Trafilatura** | Production article extractor — handles most pages |
| 4 | **Readability** | Mozilla's DOM scoring — unusual layouts |
| 5 | **FitCleaner** | Heuristic block scoring — dev docs and engineering blogs |
| 6 | **Fallback** | Basic tag stripping — always succeeds |

**`strategy: llms.txt`** = best possible result  
**`strategy: fallback`** = yellow flag — JS-heavy SPA or paywall, spot-check the output

Response headers:
```
X-Alembic-Strategy: trafilatura
X-Alembic-Cached: false
X-Alembic-Original-Tokens: 12480
X-Alembic-Clean-Tokens: 843
X-Alembic-Saved-Pct: 93%
X-Alembic-Page-Type: article
X-Alembic-Title: Example Article Title
X-Alembic-Author: Jane Smith
X-Alembic-Date: 2025-11-01
```

---

## CLI Reference

| Command | Purpose |
|---------|---------|
| `alembic <url>` | Fetch and print clean content |
| `alembic fetch <url> --stats` | Fetch with token savings report |
| `alembic batch <urls...>` | Fetch multiple URLs in parallel |
| `alembic search "query"` | Web search via Brave / Google |
| `alembic search "query" --fetch` | Search + distill + synthesize |
| `alembic serve` | Start HTTP proxy on `localhost:7077` |
| `alembic clear` | Clear entire cache |
| `alembic clear-url <url>` | Evict one URL from cache |
| `alembic lifetime` | Show lifetime token savings stats |

---

## Cache Behaviour

- **Cache location**: `~/.cache/alembic/cache.db` (SQLite, version-stamped)
- **TTL**: 1 hour — entries older than this refetch automatically
- **Cache key**: `(url, format)` — markdown and json stored separately

### If Alembic returns stale or wrong content

```bash
alembic clear                    # clear entire cache
alembic clear-url https://...    # evict one URL
alembic fetch https://... --no-cache  # bypass cache for one fetch
```

---

## If Alembic is Down

```bash
curl -s http://localhost:7077/   # if connection refused:
cd /Users/vetus/ai/Alembic && alembic serve
# Or via launchd (auto-starts on login):
launchctl load ~/Library/LaunchAgents/net.inunu.alembic-proxy.plist
```

Only fall back to WebFetch if Alembic cannot be started after restart attempt.

---

## Why This Rule Exists

1. **Token cost**: Raw HTML = 84–98% noise. Alembic strips it before it reaches the model.
2. **Search synthesis**: Web search results distilled and synthesized into one answer via `?fetch=true`.
3. **Caching**: Repeat fetches are free (SQLite, version-stamped). WebFetch has no caching.
4. **Active development**: We are building Alembic. Every use validates it and surfaces bugs.
5. **Telemetry**: Response headers give us extraction strategy, savings, page type, author, date.

---

## Quick Reference

| Situation | Command |
|-----------|---------|
| Fetch a URL | `curl -s http://localhost:7077/https://example.com` |
| Fetch as JSON | `curl -s -H "Accept: application/json" http://localhost:7077/https://example.com` |
| Web search | `curl "http://localhost:7077/?q=your+query"` |
| Search + synthesize | `curl "http://localhost:7077/?q=your+query&fetch=true"` |
| Batch fetch | `alembic batch https://a.com https://b.com` |
| Check health | `curl -s http://localhost:7077/` → `Alembic Proxy v1.0` |
| Clear cache | `alembic clear` |
| Evict one URL | `alembic clear-url https://example.com` |
| Lifetime stats | `alembic lifetime` |
| Start proxy | `cd /Users/vetus/ai/Alembic && alembic serve` |
