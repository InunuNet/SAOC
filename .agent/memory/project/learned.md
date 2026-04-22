# Learned Lessons

This file documents key learnings, decisions, and pitfalls encountered during the project's development. It serves as a knowledge base to avoid repeating mistakes and to streamline future work.

## General
- (2026-04-21) **GitHub repo:** Live at https://github.com/BDauth/SAOC (private). Athanor workspace files (`.agent/`, `.claude/`, etc.) are intentionally bundled with the Next.js website code in the same repo. Brad confirmed this is fine because the repo is private — simpler than maintaining two repos or `.gitignore` exclusions. Do NOT add `.gitignore` exclusions for `.agent/` or `.claude/`. If the repo ever goes public, revisit this decision.
- (2026-04-22) **Firebase not yet set up.** Scaffold only — no Firebase project created, no credentials, no App Hosting connection. Next session must: create Firebase project, connect BDauth/SAOC in App Hosting console, generate service account key, fill `.env.local`, add `apphosting.yaml`.
- (2026-04-22) **GitHub push to new empty repo failed** via HTTPS and SSH with `remote: fatal: did not receive expected object` — GitHub was treating the repo as part of the InunuNet/Athanor fork network (shared history) and requesting a delta base object we didn't have locally. Fix: orphan commit to sever the shared history, then push. Needed for any future repo that inherits Athanor commit history.
- (2026-04-22) **Workspace mismatch fix:** WORKSPACE file must match the directory name exactly or the `verify_workspace.sh` PreToolUse hook blocks all Bash. When onboarding a new Athanor project whose directory name differs from the template name, update both WORKSPACE and `profile.json.project_name` before anything else.

