---
schema: athanor.directive/v1
id: ATH-20261017-floor-json-probes
targets: [all]
issued_at: '2026-10-17'
status: superseded
priority: p2
supersedes: ATH-20261017-floor-prose-and-probes
superseded_by: ATH-20261017-floor-search-globs
platforms: [all]
summary: v3.8.33-37 — autonomy default, floor fits workspace, multi-line commit bodies, curl probes, downloaded JSON pretty-print
verify: python3 execution/directives.py list
---

This covers everything in ATH-20261017-floor-prose-and-probes (v3.8.33 to
v3.8.36), plus:

- **v3.8.37.** Downloaded JSON can be pretty-printed in the same command,
  as long as the consumer is exactly `python3 -I -m json.tool`. The two
  shapes are a download piped straight into it, or a download saved to a
  .json, .html or other data file and then passed to it. The `-I` is
  required. Any other interpreter after a download is still denied, local
  scripts included. To parse a download with your own script, use two
  separate Bash calls: download first, then parse. The exact rules are in
  `docs/harness-security-hardening.md`.

Do this at your next natural break between features. Do not do it in the
middle of a delivery.

1. Run `make update-template` twice. The first run replaces the updater and
   may exit 1. The second run completes. Commit the result as its own commit.
2. Record the outcome, then commit the receipt file the command names:
   `python3 execution/directives.py ack ATH-20261017-floor-json-probes --result applied`
