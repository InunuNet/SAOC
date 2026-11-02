# Sandbox Rule

Permission bypass is scoped to the project folder; work outside it prompts by hand and stalls
autonomous missions.

- Sandbox in `<project>/.tmp/sandbox/<purpose>/` (gitignored); remove your subdirectory when
  done, but leave `.tmp/sandbox/` in place. Never `/tmp`, `/private/tmp`, the session scratchpad or a bare `mktemp -d`. This binds
  shipped `contract.yaml` assertions too: an assertion that prompts cannot run in a gate.
- Never `cd`: it makes the next command's target unresolvable, which prompts the operator.
  Your cwd is the project root, so use relative paths inside it and name directories (never a
  bare `.` search root). Absolute paths are for targets outside the project, so the prompt
  that fires is approvable.
- Never put a variable in an `rm` argument: Claude Code scans for it ahead of the permission
  system. Delete computed paths with `python3 execution/safe_delete.py <paths>` (refuses
  anything outside `.tmp/sandbox`); a literal like `rm -f .tmp/sandbox/a/probe.toml` is fine.
  The floor denies `rm -rf` and `find ... -delete` outright.
- Quote every glob argument (`--include='*.sh'`): zsh expands an unquoted glob first and
  aborts on no match.
- Needing to write outside the project is stop and ask (`scope.md`).
