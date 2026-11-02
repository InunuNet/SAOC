---
schema: athanor.directive/v1
id: ATH-20261025-quota-auto-resume
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.55-56 — opt-in auto-resume of your mission after a quota reset; contract.py lint load fixed
verify: python3 execution/quota_auto_resume.py status
---

This follows ATH-20261024-operator-window. Apply that one first if you have
not.

- **v3.8.56: quota auto-resume, opt-in.** When a session stops at its 5-hour
  or weekly limit, a per-project LaunchAgent can resume the active mission
  once, headless, after the window resets. It does nothing unless you run
  `python3 execution/quota_auto_resume.py install`. It never runs while you
  are working in the project, runs at most once per limit event, bills
  only your subscription (never pay-per-use), and stops itself after
  5 hours. `status` shows what it would do;
  `uninstall` turns it off. Details: `docs/harness/quota-auto-resume.md`.
  The old Pulse resume scripts are retired and removed by the update.
- **v3.8.55.** `contract.py` loads its assertion lint by file path. A stale
  `execution/checks/assertion_lint.py` left by an older update shadowed it and
  crashed `validate` with `AttributeError: advise_command`. v3.8.56 also
  removes that stale copy when it is unedited.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Optional: `python3 execution/quota_auto_resume.py install` if the operator
   wants missions resumed after a quota reset.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-quota-auto-resume --result applied`
