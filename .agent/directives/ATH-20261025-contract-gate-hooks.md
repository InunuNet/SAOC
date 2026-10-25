---
schema: athanor.directive/v1
id: ATH-20261025-contract-gate-hooks
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.67-68 — known_broken assertion marker; project-owned pre/post gate hooks
verify: python3 execution/directives.py list
---

This follows ATH-20261025-contract-local-kinds.

- **v3.8.68: project-owned gate hooks.** `.agent/contract_kinds.json` is
  yours (WORKSPACE). It can now declare `gate_hooks`, which the stock
  `contract.py gate` runs before and after every gate:

  ```json
  {"schema": "athanor.contract-kinds/v1",
   "gate_hooks": [{"name": "residue", "stage": "post", "command": ["scripts/residue_hook.sh", "{contract}"],
                   "on_error": "open", "timeout_seconds": 300}]}
  ```

  The hook's exit decides the outcome. 0 is clean. 1 is a finding, which
  blocks the gate. Any other exit, a timeout or a command that cannot
  start is an infrastructure error: `on_error: open` warns and
  proceeds, `closed` blocks. Pre hooks run once the contract validates.
  Post hooks always run once the phases start, even after a failed
  assertion or a SIGTERM. Hook outcomes appear in `--report-json`.
  Details: `docs/VALIDATION_CONTRACTS.md`, "Project-owned gate hooks".
- **v3.8.67: `known_broken` marker.** When a harness bug breaks a shared
  assertion, mark the check
  `known_broken: {reason, ref, expires: YYYY-MM-DD}`. The expiry can be
  at most 30 days out. The gate then prints KNOWN-BROKEN with the reason
  and ref instead of failing, so nobody re-proves it is not theirs. A
  marked check that passes is flagged stale. An expired marker no longer
  excuses the failure. Errors, timeouts and codex_qa or project-kind
  findings are never excusable.

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Only if you pin `execution/contract.py` for local gate behaviour: move
   that behaviour into `gate_hooks` scripts, remove the pin, deliver the
   stock file with `python3 execution/update_template.py --apply --force-path execution/contract.py`
   (a pinned file has no baseline, so a plain update refuses it by design;
   `--force-path` backs up your copy first),
   and prove the gate still blocks what it blocked before.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-contract-gate-hooks --result applied`
