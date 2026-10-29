---
schema: athanor.directive/v1
id: ATH-20261028-python-dep-resilience
targets: [all]
issued_at: '2026-10-28'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.72 — a python3 upgrade no longer silently breaks contract.py, mission.py or boot
verify: python3 execution/boot_panel.py --format report
---

- **v3.8.72: harness scripts survive a python3 swap.** On 2026-10-27 a
  `brew upgrade` made `python3` Python 3.15, whose site-packages had no
  PyYAML or jsonschema. contract.py, mission.py and `make test` broke on
  every project on the Mac, boot said nothing, and contract.py reported
  the missing module as a parse error.
  - Those scripts now switch once to `~/.athanor-env` when the running
    `python3` lacks a module and that environment has it.
  - Otherwise they stop with one line naming the module, the interpreter
    and the fix.
  - Boot lists a `python-deps` item when the `python3` on PATH is
    missing a module.
- **Also in this release:**
  - The contract gate now counts a deletion named in an assertion's
    `command:` as covered.
  - The first `make update-template` run now ends by saying why it
    exits 1 and that one more run completes it.
- **Next.js projects:** Next 16.4 and later `next dev` writes its own
  block into AGENTS.md whenever it detects an agent. Set
  `agentRules: false` in next.config to stop it.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261028-python-dep-resilience --result applied`
