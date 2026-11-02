---
schema: athanor.directive/v1
id: ATH-20261024-boot-comms
targets: [all]
issued_at: '2026-10-24'
status: superseded
priority: p2
supersedes: ATH-20261020-local-manifest
superseded_by: ATH-20261024-shipped-blobs
platforms: [all]
summary: v3.8.38-47 — boot shows your comms.md inbox; init.sh ignores .venv; make test names live-state restores
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261020-local-manifest (v3.8.38 to v3.8.42),
plus:

- **v3.8.45.** Re-running init.sh no longer exits 1 over `{{...}}` text in
  gitignored paths such as `.venv/site-packages` or `node_modules`.
- **v3.8.46.** If `make test` puts back a mission or backlog file that a
  session edited while the suite ran, it ends with a banner. The banner
  names the file and where your version was kept.
- **v3.8.47.** Boot lists the unread messages addressed to your project or
  to FLEET on your root `comms.md`. Read them with
  `python3 execution/comms_inbox.py show`, act on them or reply, then run
  `python3 execution/comms_inbox.py ack`. The first boot after updating
  may list older messages that were never surfaced. Read them once, then
  ack.

(v3.8.43-44, the timesheet trial, is active in Athanor only.)

Update at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Start or resume a session, read the COMMS block if boot shows one, and ack.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261024-boot-comms --result applied`
