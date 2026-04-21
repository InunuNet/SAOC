---
description: Fetch a URL via Alembic proxy — returns clean Markdown for LLM pipelines. Use this instead of WebFetch for any known URL retrieval.
---

# /alembic

Fetch and distill web content through the Alembic proxy at `localhost:7077`. Returns clean Markdown with ~84-98% token reduction. No alembic installation required in your workspace.

## Usage

```bash
# Basic fetch — Markdown output
curl -s http://localhost:7077/<url>

# JSON output (includes metadata: token counts, strategy, cached flag)
curl -s -H "Accept: application/json" http://localhost:7077/<url>

# JavaScript Rendering (Playwright) — use for SPAs / React / complex sites
curl -s "http://localhost:7077/<url>?js=true"

# Auto-JS Fallback — uses JS if static extraction fails or hints are high
curl -s "http://localhost:7077/<url>?auto_js=true"

# Bypass cache (use when content must be fresh)
curl -s "http://localhost:7077/<url>?no_cache=true"
```

## Rules

1. **Use for all URL retrieval** — any time you would call WebFetch, use this instead.
2. **WebSearch is exempt** — discovery (finding URLs) is fine with WebSearch. Only URL retrieval routes through Alembic.
3. **Failure is signal** — if the proxy returns an error, surface it; never silently fall back to WebFetch. The failure is bug-surface data.
4. **Prefer Static First** — use default fetch first. Use `js=true` only if `js_hint` is high or content is missing.
5. **Cache by default** — only bypass cache when freshness is explicitly required.
6. **All subagents follow this rule** — include this rule in delegation prompts.

## JS Rendering & Signals

Alembic v1.1 implements a hardened, SSRF-safe Playwright browser.

```bash
# Check JSON metadata for JS status
curl -s -H "Accept: application/json" http://localhost:7077/<url> | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['metadata'])"
```

Key metadata fields:
- `js_hint: true` — page likely requires JavaScript rendering (score >= 4)
- `js_rendered: true` — page was fully rendered via Playwright
- `renderer: "playwright"` — browser engine used (vs "static")
- `hydration_source: "..."` — content extracted from state blobs (no rendering needed)

**When `js_hint: true`:**
- If current content is poor, re-fetch with `?js=true` or `?auto_js=true`.

## Check proxy is running

```bash
curl -s http://localhost:7077/https://example.com | head -5
```

If the proxy is not running, ask the Alembic maintainer to run `make install-daemon` in the Alembic project.
