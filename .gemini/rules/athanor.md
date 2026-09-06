# The Harness Is Upstream

Athanor is vendored source, not local source. Every file it owns is replaced
wholesale by the next `make update-template` — silently, with no merge and no
conflict marker.

## Which files it owns

Declared, never memorised: every entry marked `HARNESS` in
`<project>/.agent/update-manifest.yaml`. Read that file before editing anything
you did not write.

| | |
|---|---|
| ✅ yours | project source, `<project>/.agent/memory/`, `<project>/.agent/identity/` |
| ❌ upstream | whatever the manifest marks `HARNESS` — `execution/`, `init.sh`, `Makefile`, `template/`, `<project>/.agent/agents/`, `<project>/.agent/rules/` |

## A harness defect is filed, not patched

Open an issue or a pull request on the Athanor repository, then record the
dependency in `<project>/.agent/memory/project/backlog.md` so the work survives
until upstream lands it.

**The move you will be tempted to make and must not:** editing a harness script
in place to unblock the task in front of you. It works, right up until the next
update reverts it and the bug returns with no trace of the fix and no record that
anyone found it.

## Escalate, don't route around

Blocked by upstream behaviour with no local workaround? Say so and stop. The
escalation procedure is in `scope.md`.
