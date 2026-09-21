---
description: Mandatory Alembic usage — always route URL fetching through Alembic proxy. Full reference: load skill `alembic`.
---

# Alembic

⛔ **Always use Alembic for ALL URL fetching and web search. No exceptions.**

Other web search, fetch and HTTP tools are banned. Do not fall back to them
when Alembic is blocked, rate-limited or low-confidence. Browser tools are
allowed only for a user-requested live UI interaction, never for discovery or
source retrieval.

When Alembic returns `blocked`, `low` confidence, an error page, or a token
floor warning, read `.agent/skills/alembic.md` before retrying. Use the advanced
paths that match the failure: `no_cache=true`, `js=true`, `x-alembic-wait-for`,
`x-alembic-grace-ms`, `x-alembic-scroll`, sitemap/RSS/JSON routes, batch fetch,
or configured stealth after its documented trigger. A failed Alembic recovery
is an evidence gap; it is never permission to use another web tool.

Route: `curl -s http://localhost:7077/<url>` | Search: `curl "http://localhost:7077/?q=query"` | Full docs: load skill `alembic`.
