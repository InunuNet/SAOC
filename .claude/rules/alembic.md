---
description: Mandatory Alembic usage rule — all URL fetching must go through Alembic proxy.
---

# Alembic — Mandatory URL Fetching Rule

## ⛔ NEVER fetch a URL directly. Always use Alembic. No exceptions.

Alembic is a local HTTP proxy at `http://localhost:7077` that distills raw web pages into clean LLM-ready Markdown. It reduces token consumption by 84–98%. This is an active project we are developing — every use validates it and surfaces bugs.

---

## How to Use

```bash
# Health check (run if unsure it's up)
curl -s http://localhost:7077/
# Expected response: "Alembic Proxy v1.0"

# Fetch any URL — returns clean Markdown by default
curl -s http://localhost:7077/https://example.com

# Get JSON with metadata (title, strategy, token counts)
curl -s -H "Accept: application/json" http://localhost:7077/https://example.com

# Batch fetch multiple URLs (use the CLI directly)
alembic batch https://url1.com https://url2.com --concurrency 5
```

---

## How Alembic Works (5-Stage Cascade)

Alembic tries these in order, stopping at the first that produces clean content:

| Stage | Strategy | What it does |
|-------|----------|-------------|
| 1 | `llms.txt` | Reads `/llms.txt` if the site publishes one — curated LLM-ready content, zero extraction |
| 2 | `content-negotiation` | Requests `text/markdown` via Accept header — uses it if the server cooperates |
| 3 | `trafilatura` | Production-grade article extractor, handles the vast majority of real pages |
| 4 | `readability` | Mozilla's Readability algorithm as fallback for unusual DOM structures |
| 5 | `fallback` | Strips all HTML tags — always succeeds but lowest quality |

**`strategy: llms.txt`** = best possible result (site author pre-curated the content)  
**`strategy: fallback`** = yellow flag — JS-heavy SPA or paywall, spot-check the output

Response headers tell you what happened:
```
X-Alembic-Strategy: trafilatura
X-Alembic-Cached: false
X-Alembic-Original-Tokens: 12480
X-Alembic-Clean-Tokens: 1204
X-Alembic-Saved-Pct: 90%
```

---

## Cache Behaviour

- **Cache location**: `~/.cache/alembic/cache.db` (SQLite)
- **TTL**: 1 hour — entries older than this are treated as misses and refetched
- **Cache key**: `(url, format)` — markdown and json of the same URL are stored separately
- **First fetch**: hits network, extracts, caches. Subsequent fetches: sub-millisecond from SQLite.

### If Alembic returns stale or wrong content

**Do NOT bypass Alembic.** Clear the cache and refetch:

```bash
# Clear the cache
alembic clear

# Or bypass cache for one fetch (still writes back to cache)
curl -s http://localhost:7077/https://example.com  # will refetch after clear

# Or use CLI with --no-cache flag
alembic fetch https://example.com --no-cache
```

---

## If Alembic is Down

Start it — do not fall back to WebFetch or raw curl:

```bash
# Check if running
curl -s http://localhost:7077/
# If connection refused:
cd /Users/vetus/ai/Alembic && alembic serve
# Or via launchd (auto-starts on login):
launchctl load ~/Library/LaunchAgents/net.inunu.alembic-proxy.plist
```

Only fall back to WebFetch if Alembic cannot be started after attempting a restart.

---

## Python API (for scripts and agents)

```python
from execution.alembic import fetch_clean, fetch_clean_with_stats

# Simple — returns clean content string
content = fetch_clean("https://example.com")

# With metadata — returns dict with content, strategy, token counts, cached flag
result = fetch_clean_with_stats("https://example.com")
print(f"Strategy: {result['strategy']}, Saved: {result['saved_pct']}%")
```

---

## Why This Rule Exists

1. **Token cost**: Raw HTML = 84–98% noise. Alembic strips it before it reaches the model.
2. **Active development**: We are building Alembic. Every use surfaces bugs and validates it works.
3. **Caching**: Repeat fetches are free (SQLite cache). WebFetch has no caching.
4. **Telemetry**: Response headers give us extraction strategy and savings data — useful for debugging.

---

## Quick Reference

| Situation | Command |
|-----------|---------|
| Fetch a URL | `curl -s http://localhost:7077/https://example.com` |
| Fetch as JSON | `curl -s -H "Accept: application/json" http://localhost:7077/https://example.com` |
| Batch fetch | `alembic batch https://a.com https://b.com` |
| Check health | `curl -s http://localhost:7077/` → `Alembic Proxy v1.0` |
| Clear cache | `alembic clear` |
| Lifetime stats | `alembic lifetime` |
| Start proxy | `cd /Users/vetus/ai/Alembic && alembic serve` |
