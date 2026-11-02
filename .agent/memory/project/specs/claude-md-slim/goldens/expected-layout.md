# Expected layout after the slim (golden)

Pinned source: `git show c759899f5fe4a6ec95e0d96ab53bc28f020f301a:CLAUDE.md` (18.8 KB).

## CLAUDE.md (<= 7000 bytes), byte-identical to the pin
- title line and Client Context (including "Critical scope boundary")
- Tech Stack, Coding Conventions, Running Locally, Deployment

## CLAUDE.md pointers (one short line each, naming section and PROJECT_GUIDE.md)
- Project Structure
- Firebase Setup
- Adding Data (No Code Changes Needed)
- Design Handoff Workflow

Pointer lines may sit under one new heading. No other new text.

## PROJECT_GUIDE.md
- Opens with one new `# ` title line plus at most one intro line; every other
  non-blank line is a line of the pinned CLAUDE.md.
- Each moved `##` section appears contiguous and verbatim under its original heading
  (the `###` subsections travel with it).

## Scope
Only CLAUDE.md and PROJECT_GUIDE.md change outside .agent/, .codex/, branding/,
test-results/, .tmp/. Measured size of the kept sections alone is about 3.5 KB, so the
7000-byte limit holds without raising it.
