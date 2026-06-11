---
description: File a bug report against InunuNet/Athanor — the upstream Athanor harness repo. The ONLY sanctioned path for harness agents to create issues on InunuNet/Athanor.
---

# /report-harness-bug

File a structured bug report against the upstream Athanor harness repo (`InunuNet/Athanor`). This skill is the only sanctioned path for any harness agent to create an issue on that repo.

## Step 1 — Collect bug details from the user/context

Ask for (or gather from context):
1. **Bug title** — one line, concise
2. **What happened** — description of the incorrect behaviour
3. **Expected behaviour** — what should have happened instead
4. **Reproduction steps** — numbered steps if known, or "Not captured"

## Step 2 — Read project context

Run each command and capture the output:

```bash
# Project name
project_name=$(cat WORKSPACE 2>/dev/null || echo "unknown")

# Harness version
version=$(cat .agent/version 2>/dev/null || echo "unknown")

# Platform (primary_platform field from profile.json)
platform=$(python3 -c "import json,sys; p=json.load(open('.agent/profile.json')); print(p.get('primary_platform','unknown'))" 2>/dev/null || echo "unknown")
```

## Step 3 — Build the issue body

Render this template with the collected values:

```
**Project:** <project_name>
**Platform:** <platform>
**Harness version:** <version>

## What happened
<description>

## Expected behaviour
<expected>

## Reproduction steps
<steps or "Not captured">

---
*Filed automatically by report-harness-bug skill*
```

## Step 4 — File the issue via `gh`

Check whether `gh` is available and authenticated, then attempt to file:

```bash
if ! command -v gh > /dev/null 2>&1; then
  echo "GH_UNAVAILABLE"
elif ! gh auth status > /dev/null 2>&1; then
  echo "GH_AUTH_FAIL"
else
  gh issue create --repo InunuNet/Athanor --title "[BUG] <title>" --body "<body>"
fi
```

One attempt only. Do not retry.

## Step 5 — Fallback if `gh` is unavailable or auth fails

If `command -v gh` returns non-zero, `gh auth status` fails, or `gh issue create` exits non-zero, print the fully-rendered issue body with this header and no further action:

```
===== MANUAL PASTE — paste into https://github.com/InunuNet/Athanor/issues/new =====
<rendered issue body>
================================================================================
```

## Rules

- This skill is **user/agent-invoked only** — never automatic.
- File against `InunuNet/Athanor` exclusively. No other repo.
- `gh issue create` is the only write operation this skill performs against InunuNet/Athanor.
- Do not add labels, assignees, or milestones — keep the invocation minimal.
