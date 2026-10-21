---
name: web-design-guidelines
description: Review UI code against Vercel's Web Interface Guidelines (accessibility, focus, forms, animation, typography, performance). Outputs terse file:line findings.
---

<!-- Provenance: https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md, fetched 2026-10-16 via Alembic. Frontmatter added locally; body verbatim. Rules vendored in command.md from https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md, fetched 2026-10-16. -->

# Web Interface Guidelines

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Fetch the latest guidelines from the source URL below
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the fetched guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

Fetch fresh guidelines before each review:

```
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

Use WebFetch to retrieve the latest rules. The fetched content contains all the rules and output format instructions.

## Usage

When a user provides a file or pattern argument:
1. Fetch guidelines from the source URL above
2. Read the specified files
3. Apply all rules from the fetched guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.

---

## SAOC project override

This section outranks everything above.

- Do NOT fetch the guidelines from the URL and do NOT use WebFetch. Web retrieval on this project goes through Alembic only. The rules are vendored in `command.md` in this skill directory; read that file instead. Refresh only deliberately via Alembic.
- Use this skill for review and implementation polish only (accessibility, focus, forms, motion, performance, hydration safety). It is a checklist, not a source of visual decisions.
- The "Content & Copy" section (Title Case, "&", second person, rewording labels) and any typography rule that would change text (curly quotes, nbsp) must not be applied to official committee copy, which is reproduced verbatim (docs/rules/no-invention.md). Flag such items as observations; never rewrite copy.
- Palette, typography, imagery, logos and brand choices come ONLY from approved sources: design/design_handoff_saoc/, branding/, the NOS v4 spec in .tmp/sandbox/nos-chrome-handoff/, and NOS Design lead rulings. Findings that need a visual decision (for example a focus ring colour, a contrast fix needing a new token) are named as gaps and routed to the design lead, never invented.
- Report findings; fix only what was asked, minimally.
