# Pre-existing checks edited (supersession)

- .agent/memory/project/specs/ticket-onsale-predicate/contract-f1.yaml (F6a): assertion A7's command had `$p` inside a double-quoted sed script, which the shell
  expands to nothing, so the assertion could never fail. The sed script is now single-quoted. Same intent (the prerendered /national-show page must not reach
  firebase-admin), same target string; contracts/checks/polish-wave-2-2026-10-25/f6-a7-nonvacuous.py proves the filter stage now keeps a VIOLATIONS line.
