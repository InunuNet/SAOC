---
schema: athanor.directive/v1
id: ATH-20261025-contract-local-kinds
targets: [all]
issued_at: '2026-10-25'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.66 — contract.py runs project-owned check kinds from .agent/contract_kinds.json; no need to pin contract.py
verify: python3 execution/directives.py list
---

This follows ATH-20261025-git-index-lock.

- **v3.8.66: project-owned check kinds.** If your project adds its own
  contract check `type:` (SAOC: `browser_deployed_check`, `gws_inbox_check`),
  you no longer need to pin `execution/contract.py` in `.agent/no-update`.
  A pin is why harness gate changes, such as v3.8.64's `--prove-nonvacuous`,
  never reached your live gate. Declare the kinds in
  `.agent/contract_kinds.json`. The file is yours (WORKSPACE), and updates
  never touch it:

  ```json
  {"schema": "athanor.contract-kinds/v1",
   "kinds": {"browser_deployed_check": {"script": "execution/browser_deployed_check.sh", "timeout_seconds": 200}}}
  ```

  Each kind runs `<script> <target>` under the codex_qa protocol: 0 pass,
  1 fail, and 2, any other exit, a timeout or a missing script are
  inconclusive. A check-level `script:` overrides the registry. A broken
  registry fails `validate`. Details: `docs/VALIDATION_CONTRACTS.md`,
  "Project-owned check kinds".

Update at your next natural break between features.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Only if you pin `execution/contract.py` for custom kinds: write the
   registry, remove the pin, then deliver the stock file with
   `python3 execution/update_template.py --apply --force-path execution/contract.py`
   (a pinned file has no baseline, so a plain update refuses it by design;
   `--force-path` backs up your copy first). Then
   prove that `python3 execution/contract.py validate <a contract using
   your kinds> --strict` passes. If your pinned copy carries other
   behaviour (SAOC: triad exit 1 vs 2), keep the pin and reply on comms
   naming that behaviour.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261025-contract-local-kinds --result applied`
