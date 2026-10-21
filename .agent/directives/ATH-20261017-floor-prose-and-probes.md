---
schema: athanor.directive/v1
id: ATH-20261017-floor-prose-and-probes
targets: [all]
issued_at: '2026-10-17'
status: superseded
priority: p2
supersedes: ATH-20261017-floor-fits-workspace
superseded_by: ATH-20261017-floor-json-probes
platforms: [all]
summary: v3.8.33-36 — autonomy default, floor fits workspace, multi-line commit bodies, curl -o /dev/null probes
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261017-floor-fits-workspace (v3.8.33 and
v3.8.34), plus:

- **v3.8.35.** `curl -s -o /dev/null -w '%{http_code}' <url> && <tests>` is
  allowed. A `/dev/null` output target is not a file write.
- **v3.8.36.** A multi-line commit message body is read as prose. The floor
  no longer denies a commit because a later line mentions a protected path
  or a dangerous command. A body that contains a backtick or `$(` is still
  read line by line.
- **Agent definitions.** Architects have Write and Edit for their contract
  and golden files. Architect and dev agents re-read the contract on disk
  before reporting done, so an amended contract wins over an older queued
  message.

Do this at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261017-floor-prose-and-probes --result applied`
