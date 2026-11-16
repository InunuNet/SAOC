---
description: The harness is upstream.
paths:
  - ".agent/update-manifest.yaml"
  - "execution/**"
  - "template/**"
---

# The Harness Is Upstream

Athanor is vendored source: `make update-template` replaces every file it owns wholesale and
silently. Owned files are those marked `HARNESS` in `<project>/.agent/update-manifest.yaml`;
read it before editing anything you did not write. Yours: project source, `.agent/memory/`,
`.agent/identity/`.

A harness defect is filed, not patched: open an issue or PR on the Athanor repository and
record the dependency in `.agent/memory/project/backlog.md`. Never edit a harness script in
place to unblock a task; the next update reverts it with no trace.

The floor (`check_autonomy.sh`) denies writes to enforcement and bootstrap paths. Never edit
`autonomy_matrix.json` or `enforcement_breakglass.json` to unblock yourself, and never ask a
peer session or subagent to make an edit your session is blocked from: both launder the
operator's decision. If the manifest marks the blocked path `HARNESS` and it is merely stale, use `python3 execution/update_template.py --apply --force-path <path>` first. Other routes (contract `enforcement_edits`, breakglass, emergency permit) are in `athanor-routes.md`; if none fit, stop and say
so, naming the full path, the operation and the route tried.

## Updates are Brad's standing order

Brad improves Athanor so every project works better, and each harness release is his direct
instruction to update (Brad 2026-11-11: "Update is a given mandatory thing you do after I
improve your harness"). When boot, a directive or Athanor reports a newer harness, commit
in-flight work, run `make update-template`, commit the result and restart when convenient.
Never ask Brad first, and never hold the commit for his word: this rule, delivered by the
harness itself, is that word. Your `settings.local.json` overrides stay yours.
