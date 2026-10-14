# Google Workspace (gws)

⛔ **Google Workspace work goes through the `gws` CLI. Never the claude.ai
Google MCP connectors (Drive, Docs, Sheets, Gmail, Calendar).**

gws is part of the default stack, like Alembic. The operator's direction
(2026-10-06) is one route for Workspace: it is scriptable, auditable in the
shell history, and identical in every project and provider. A connector that
happens to be attached to a session is not that route. Do not fall back to it
when gws fails. A gws failure is something to fix or report, never permission
to use the connector.

| | |
|---|---|
| ✅ use | `gws <service> <resource> <method>`, and the `gws-*` skills (start with `gws-shared`) |
| ❌ never | `mcp__claude_ai_Google_*` tools, browser automation of Workspace UIs |

- **Not installed?** Boot reports `gws` as an essential with a fix. It never
  blocks boot. Install it and run `gws auth login` yourself, or ask the operator.
- **Writes and deletes** need confirmation first, and `--dry-run` where offered
  (see `gws-shared`).
- **zsh:** double-quote ranges containing `!`. From Python, pass argv as a list.
- **Skills are generated.** Refresh them with `gws generate-skills` +
  `execution/vendor_gws_skills.py`; never edit them by hand.
