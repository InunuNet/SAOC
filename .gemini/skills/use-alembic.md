# use-alembic

Use the Alembic proxy to fetch web content or search the internet. Saves 84-98% tokens vs raw HTML. Always use this instead of WebFetch or raw curl for external URLs.

## When to use
- Any time you need to research something on the internet
- Looking up documentation, APIs, current library versions
- Searching for solutions to bugs or errors
- Getting current information (Alembic uses live web, not training data)

## Fetch a URL (returns clean Markdown)
```bash
curl -s http://localhost:7077/https://example.com
```

## Search the web
```bash
curl "http://localhost:7077/?q=your+search+query"
```

## Search + synthesize top results into one answer
```bash
curl "http://localhost:7077/?q=your+query&fetch=true"
```

## Health check
```bash
curl -s http://localhost:7077/
# Should return: Alembic Proxy v1.0
```

## If Alembic is down
```bash
cd /Users/vetus/ai/Alembic && alembic serve
```

## Why this matters
- Raw HTML = 84-98% noise tokens. Alembic strips it before it reaches you.
- Search + synthesize = one answer instead of N raw result pages.
- Cached: repeat fetches are free (SQLite cache, 1hr TTL).
- Do NOT use WebFetch tool when Alembic is available — it wastes tokens.

## Example: research a bug fix
```bash
curl "http://localhost:7077/?q=python+sqlite+connection+closed+fix&fetch=true"
```
