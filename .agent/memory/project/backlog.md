# Athanor Issue Backlog

## Priority (v3.x Stability)
- [ ] Inbox (AutoFix): Auto-fix Job Run (auto_fix_issues-20260421121634.txt)
- [ ] Inbox (AutoFix): Auto-fix Job Run (auto_fix_issues-20260421121504.txt)
- [x] Inbox (GitHub): GitHub #61: P1: SessionStart hook hardcodes 'Identity: Vex' — leaks template default into downstream projects
- [ ] Inbox (GitHub): New GitHub Issue (filename: check_github-20260421121132.txt)
- [ ] Inbox (GitHub): GitHub #60: P1: make update-template misses new execution/ scripts (onboard_fill.py, get_pulse_status.sh, sync_rules.sh, etc.)
- [ ] Inbox (AutoFix): Auto-fix Job Run (auto_fix_issues-20260421120035.txt)
- [x] Inbox (GitHub): GitHub #52: Bug: 'make update-template' fails due to missing directories in upstream tarball
- [ ] Inbox (GitHub): GitHub #46: [TEMPLATE BUG] Triple Version Mismatch: Makefile (v2.2.2) vs README vs Hooks
- [ ] Inbox (GitHub): GitHub #47: [TEMPLATE BUG] Boot sequence lacks Discovery & Capabilities summary
- [x] Inbox (GitHub): GitHub #53: [TEMPLATE BUG] make update-template overwrites CLAUDE.md with unfilled {{AGENT_NAME}}/{{PROJECT_ROLE}} placeholders, destroys user customization
- [ ] Inbox (GitHub): GitHub #45: [TEMPLATE BUG] Alembic proxy and mandate missing from boot context
- [x] Inbox (GitHub): GitHub #51: Bug: Gemini CLI settings.json used 'onSessionStart' instead of 'SessionStart'
- [x] Inbox (GitHub): GitHub #50: [TEMPLATE BUG] make update-template fails during rsync (Missing source directories)
- [ ] Inbox (GitHub): GitHub #44: [TEMPLATE BUG] Brittle GitHub Auth Check in full_boot.sh
- [ ] Inbox (GitHub): GitHub #49: [TEMPLATE BUG] Pulse/Inbox integration is broken and undocumented
- [ ] Inbox (GitHub): GitHub #48: [TEMPLATE BUG] Boot sequence lacks Upstream Service Mapping (e.g., Alembic)
- [x] #52: TEMPLATE BUG: 'make update-template' fails due to missing directories in upstream tarball
- [x] #51: TEMPLATE BUG: Gemini CLI settings.json used 'onSessionStart' instead of 'SessionStart'
- [x] Inbox (GitHub): GitHub Issue: Bug: 'make update-template' fails due to missing directories in upstream tarball
- [x] Inbox (GitHub): GitHub Issue: Bug: Gemini CLI settings.json used 'onSessionStart' instead of 'SessionStart'
- [ ] Inbox (Alert): AGENT_FAILURE: @qa failed to validate symlinks
- [ ] Inbox (Misc): 🔄 Initialising update checkpoint...

*These issues are critical for stabilizing the v3.x template and must be addressed before starting v4.0 work.*

- [ ] #38: Boot: auto-onboarding not triggered; WORKSPACE drift hard-locks Bash
- [ ] #37: Bug: Automatic boot hook missing in .gemini/settings.json
- [ ] #35: Bug: Harden Gemini Policy Schema to address unauthorized tool call bug
- [ ] #34: Bootstrap instructions drift from what origin/main actually ships
- [ ] #33: Template repo lacks a clean self-update path for Athanor itself
- [ ] #31: Claude PreToolUse write/edit guards do not parse hook JSON and silently fail open
- [ ] #30: Boot blocker scan branch is inverted in full_boot.sh
- [ ] #29: Subagent hook pipeline truncates context and never completes maintainer handoff
- [ ] #28: init scaffold can poison learned.md and test-init breaks on paths with spaces
- [ ] #27: verify_workspace.sh blocks valid repos when folder name differs from project identity
- [ ] #26: Boot contract gap for providers without native SessionStart hooks
- [x] #23: bug: sync_skills.sh exits 1 when .claude/skills and .gemini/skills are symlinks to .agent/skills
- [ ] #22: bug: `make update-template` rsync with --delete silently no-ops; reports success but transfers nothing
- [ ] #21: Automatic boot hook not wired to .gemini/settings.json in v2.2.1
- [ ] #20: bug: /wrap-up silently skips backlog tick when backlog uses tables/bullets instead of [ ]/[x] checkboxes
- [ ] #19: docs: template update procedure not surfaced in AGENTS.md or as a boot-loaded workflow
- [ ] #18: Autonomy Friction: Sub-agent delegation triggers excessive permission prompts
- [ ] #17: Bug: New project creation skips onboarding when using existing profile

## Blocked (v4.0 Features)

*These v4.0 features are blocked pending the stabilization of the v3.x series. Do not start work on these items until all issues in the 'Priority' section are complete.*

- [ ] #36: Feature: Global Pulse Service (Fleet-wide monitor)
- [ ] #32: Feature: add an automated template self-test suite that catches autonomy regressions
- [ ] #11: feat: Pain Point Monitor — recurring analyst loop for proactive pivot recommendations

## Completed

- [x] #59: [SysMon] Successful Migration to v3.3.4 (Fixed hardcoded version regressions in merge_profile, init.sh, and full_boot.sh)
- [x] #58: [REGRESSION] v3.3.4 Update Process Failures (Placeholders, Missing Dirs, Invalid Hooks)
- [x] Log L48: 'Quota-Aware Heartbeat' — Document that high-velocity autonomous fleets must include forced latency (sleep) to avoid provider rate-limit locks. Add a 'Pulse Status' section to the manual /boot workflow.
- [x] #56: [TEMPLATE BUG - P2] /onboard skill instructions reference 'replace' and 'write_file' tools (provider coupling)
- [x] #55: [TEMPLATE BUG - P1] /onboard skill never fills {{AGENT_NAME}} / {{PROJECT_ROLE}} placeholders in AGENTS.md
- [x] #54: [TEMPLATE BUG — P0] full_boot.sh:99 has hardcoded absolute path
- [x] #49: [TEMPLATE BUG] Pulse/Inbox integration is broken and undocumented
- [x] #48: [TEMPLATE BUG] Boot sequence lacks Upstream Service Mapping (e.g., Alembic)
- [x] #47: [TEMPLATE BUG] Boot sequence lacks Discovery & Capabilities summary
- [x] #46: [TEMPLATE BUG] Triple Version Mismatch: Makefile (v2.2.2) vs README vs Hooks
- [x] #47: [TEMPLATE BUG] Boot sequence lacks Discovery & Capabilities summary
- [x] #46: [TEMPLATE BUG] Triple Version Mismatch: Makefile (v2.2.2) vs README vs Hooks
- [x] #45: [TEMPLATE BUG] Alembic proxy and mandate missing from boot context
- [x] #44: [TEMPLATE BUG] Brittle GitHub Auth Check in full_boot.sh
- [x] #43: [TEMPLATE BUG] Version Inconsistency: README (v2.0.0) vs Hooks (v3.1.2)
- [x] #42: [TEMPLATE BUG] Misnamed hooks in .gemini/settings.json
- [x] #41: Infrastructure & Interaction Gaps: Alembic Knowledge and Makefile Desync
- [x] #39: Structural inconsistencies and rsync failures in v2.2.2 update-template
- [x] #15: bug: project settings.json ask rule triggers on project-owned files + missing settings tier docs
- [x] #14: bug: overlay_template.sh leaves orphan files — cp -r does not delete removed-upstream paths
- [x] #13: bug: verify_workspace.sh strips internal spaces — breaks project names with spaces
- [x] #10: Enforce memory path redirection — block PAI writes to ~/.claude/MEMORY/
- [x] #8: Stop hook fires on every Claude Code response — should use SessionEnd
- [x] #7: Ship complete Claude Code adapter: settings.json hooks, slash commands, agents, skills (model-agnostic template requires per-platform wiring)
- [x] #6: Template docs promise Claude Code integration that is never generated (no hooks, no slash commands, no agents)
- [x] #4: Bug: brain.py wrap-up crashes when scratch/ contains a subdirectory
- [x] #3: Template audit: 3 gaps found in v1.1.0
- [x] #2: Bug: /onboard overwrites profile.json entirely — template infrastructure fields lost
