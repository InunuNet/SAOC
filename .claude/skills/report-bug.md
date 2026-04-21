---
description: Report a bug in the Athanor template — creates a GitHub issue on InunuNet/Athanor
argument-hint: "[bug description]"
---

# /report-bug

Follow `.agent/workflows/report-bug.md` exactly.

## Quick Reference

1. Gather context: template version (.agent/version), platform, project type, git status
2. Ask user to describe the bug if not provided as argument
3. Create GitHub issue on InunuNet/Athanor using `gh issue create`
4. If `gh` not available, write bug report to `.agent/memory/scratch/bug-report.md`
