---
description: Google Workspace goes through the gws CLI, never the claude.ai Google connectors.
---

# Google Workspace (gws)

Google Workspace work goes through the `gws` CLI (`gws <service> <resource> <method>`; skills
`gws-*`, start with `gws-shared`). Never the claude.ai Google MCP connectors (Drive, Docs,
Sheets, Gmail, Calendar) or browser automation of Workspace UIs, and do not fall back to them
when gws fails: fix or report the failure.

- Not installed: boot reports it as an essential, never blocking. Install it and run
  `gws auth login`, or ask the operator.
- Writes and deletes need confirmation first, and `--dry-run` where offered.
- zsh: double-quote ranges containing `!`; from Python pass argv as a list.
- Skills are generated (`gws generate-skills` + `execution/vendor_gws_skills.py`); never
  edit by hand.
