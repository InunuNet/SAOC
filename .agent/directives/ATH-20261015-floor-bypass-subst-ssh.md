---
schema: athanor.directive/v1
id: ATH-20261015-floor-bypass-subst-ssh
targets: [all]
issued_at: '2026-10-15'
status: active
priority: p1
supersedes: null
superseded_by: null
platforms: [all]
summary: v3.8.28 — the autonomy floor now sees commands hidden in $( ), function bodies and ssh ProxyCommand
verify: python3 execution/directives.py list
---

Athanor v3.8.28 closes two security gaps in the autonomy floor (GH #1427,
#1414). Both let a command the floor always denies run anyway.

What changed:

- A denied command inside `$( … )`, backticks, `<( … )` or a shell function
  body (`f(){ find … -delete; }; f`) is now denied, the same as when it is
  typed bare.
- A floor-protected path or denied command inside an ssh, scp or sftp
  `ProxyCommand`, `LocalCommand` or `RemoteCommand` value, or in the ssh
  remote command, is now denied.
- `echo "it's $(…)"` and a quoted `)` inside a substitution no longer hide
  the payload, on the protected-path read check as well.

Still allowed: `$(date)`, `x=$(git rev-parse HEAD)`, `ssh host uptime`,
`ssh -o ConnectTimeout=5 host`, and commit messages that mention a denied
command.

Known side effect: a `$( … )` inside a `#` comment is still scanned. If a
comment trips the floor, move the text out of the comment.

Do this in your own checkout:

1. Run `make update-template` twice.
2. Confirm that `echo "$(date)"` runs without a floor denial.
3. Record the outcome:
   `python3 execution/directives.py ack ATH-20261015-floor-bypass-subst-ssh --result applied`
