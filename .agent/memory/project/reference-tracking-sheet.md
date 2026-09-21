---
name: reference-tracking-sheet
description: The Google Sheet Brad tracks site content/audit status in — the canonical external tracker for this project's maintenance/content dataset.
metadata:
  type: reference
---

The Google Sheet used to track SAOC NOS Site's content/audit status dataset:

https://docs.google.com/spreadsheets/d/1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo/edit?gid=1602704297#gid=1602704297

**Why this matters:** this has been worked on/referenced multiple times across sessions but was
never written down anywhere durable in-project, so it got re-asked for and that cost real trust
(2026-09-18 — Brad had to paste it a second time, was rightly frustrated). Never ask for this URL
again — read this file first. If a future session can't reach it or the gid changes, say so and
ask what changed, don't re-ask for the base link.

**How to apply:** before starting any content/site audit, coverage-status, or "update the tracking
sheet" task, check this file first. **Access is via the `gws` CLI (`/opt/homebrew/bin/gws`),
already authenticated — NOT the `mcp__claude_ai_Google_Drive` connector, and NOT an OAuth prompt.**
This is standing project convention (per Brad, 2026-09-18: "we use GWS for google access not
MCPs"). Read: `gws sheets spreadsheets get --params '{"spreadsheetId": "1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo"}'`
or `spreadsheets.values.get` for a specific range. Write: `spreadsheets.values.update` or
`.append`. Spreadsheet ID: `1CEq5_670M1Q-AA5ZyJ30ycASptsy2Is5sHJhMXNyClo`. Run `gws --help` /
`gws schema sheets.spreadsheets.<method>` for the full API surface.
