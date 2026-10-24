---
schema: athanor.directive/v1
id: ATH-20261024-shipped-blobs
targets: [all]
issued_at: '2026-10-24'
status: superseded
priority: p2
supersedes: ATH-20261024-boot-comms
superseded_by: ATH-20261024-operator-window
platforms: [all]
summary: v3.8.38-48 — an unedited old Makefile/init.sh is delivered without --force-path; boot comms inbox
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261024-boot-comms (v3.8.38 to v3.8.47),
plus:

- **v3.8.48.** `make update-template` no longer withholds a Makefile or
  `init.sh` just because it is an unedited copy of an OLDER release than
  the one you record. Each release now ships `execution/shipped_blobs.txt`,
  a list of every file version Athanor has shipped, and the updater
  delivers a file whose bytes match a shipped version of that same path.
  A file you edited still stays withheld. See "The shipped-blob ledger" in
  `docs/harness/UPDATE_TEMPLATE.md`.

Update at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. If a third run still lists
   Makefile or `init.sh` as withheld, they really differ from everything
   Athanor shipped: review the diff before using `--force-path`. Commit the
   result as its own commit.
2. Start or resume a session, read the COMMS block if boot shows one, and ack.
3. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261024-shipped-blobs --result applied`
