---
schema: athanor.directive/v1
id: ATH-20261013-floor-glob-fp
targets: [all]
issued_at: '2026-10-13'
status: active
priority: p2
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.26 — the autonomy floor no longer denies ordinary in-project wildcards like `ls -d */`
verify: python3 execution/directives.py list
---

Athanor v3.8.26 fixes the false positive SAOC reported on 2026-10-08:
`ls -d */` and `file .tmp/sandbox/x/*` were denied as a "read of protected
path", because a bare wildcard matched a protected directory name.

What changed:

- A wildcard in one simple command is now judged by what it actually matches
  on disk. One simple command means no `;`, `&&` or `|`, no substitution, no
  `cd`.
- Anything else, including a multi-command line, keeps the old, stricter
  check. If a glob command is still denied, split it into its own call.
- Writes spelled with a wildcard are now checked against the real files they
  match, and so is `cp`/`mv` into a directory. A few commands that used to
  pass are now denied.

Do this in your own checkout:

1. Run `make update-template` twice.
2. Confirm that `ls -d */` now runs without a floor denial.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261013-floor-glob-fp --result applied`
