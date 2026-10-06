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

## The floor blocks a path you need to edit

`check_autonomy.sh` denies writes to enforcement and bootstrap paths
unconditionally: `init.sh`, `full_boot.sh`, `CLAUDE.md`/`AGENTS.md`/`GEMINI.md`,
`.claude/settings.json`, `.claude/hooks/*`, `execution/hooks/*`,
`.agent/autonomy_matrix.json`, `.agent/enforcement_breakglass.json`, plus
credential stores. A denial is not a bug and not a puzzle to solve.

**Never edit `autonomy_matrix.json` or `enforcement_breakglass.json` to unblock
yourself, and never ask a peer session or subagent to make the edit for you.**
Both launder the operator's decision instead of obtaining it. There are three sanctioned
routes plus an emergency one, and one of them covers your case.

| the file is | route |
|---|---|
| HARNESS-owned (manifest says so) and merely stale | `python3 execution/update_template.py --apply --force-path <path>` |
| yours, and the edit is part of active mission work | Route 1 — contract `enforcement_edits` |
| yours, and it is a one-off with no mission | Route 2 — operator breakglass |
| urgent, no mission, and the operator is away | Route 3 — emergency permit |

**`--force-path` first.** If the manifest marks the path `HARNESS`, you do not
need an exception at all: the updater writes it itself, so no agent tool call
is intercepted and the floor never engages. It backs up the old copy. This is
the whole answer for a stale `init.sh` or a hook the template already owns.

**Route 1 — contract `enforcement_edits`.** For project-owned files an active
mission legitimately has to touch. Add an `enforcement_edits` entry naming each
exact path to the feature's contract, then run the normal chain. The permit is
scoped to those paths for that mission, and the contract is the audit record of
what was changed and why. This is the right route whenever the edit is real
work rather than an emergency — prefer it, and do not ask the operator to run
commands by hand that an agent should own.

**Route 2 — operator breakglass.** The operator creates
`.agent/enforcement_breakglass.json` naming one path. It is single-use, expires
in 15 minutes, and is consumed the moment a permit is issued. Only a human
creates it: an agent writing that file is the laundering case above, and the
floor denies it for exactly that reason. Use it for a genuine one-off with no
mission to attach to.

**Route 3 — emergency, no mission required.** Every project has this; it is
why a blocked session no longer has to wait for the operator. Write
`.agent/enforcement_emergency.json` naming ONE exact path, with a `reason`
of at least 20 characters and a `created_at` timestamp:

```json
{
  "path": ".claude/settings.json",
  "reason": "emergency: boot is failing on a stale hook registration",
  "created_at": "2026-09-21T19:20:00Z"
}
```

It expires in 30 minutes, is consumed the moment it grants, covers that one
path and no other, and every grant lands in
`.agent/memory/project/enforcement_edit_audit.log` under `method:
"emergency"` with your reason attached. One path per permit — there is no
batch form, deliberately.

**What Route 3 can never reach**, whatever the permit says: credential
stores (`.env`, `.ssh/`, `.aws/`, `.gnupg/`, `*.pem`, `*.key`, `secrets/`),
`.git/`, `autonomy_matrix.json`, the breakglass and emergency files
themselves, and `check_autonomy.sh`. A permit that can rewrite the thing
evaluating permits is not a one-time grant, and an agent that can mint a
permit for `~/.ssh` has exfiltration rather than an emergency. Those paths
still need Route 1 or the operator.

**Prefer Route 1 when a mission is open.** Route 3 leaves a one-line reason;
Route 1 leaves a contract, a diff, and a gate. Use the emergency route for
what it is named after.

**If none of these fit, stop and say so.** Name the full path, the
operation, and which route you tried. A blocked edit reported plainly costs the
operator one decision; an edit routed around costs them an incident.

## Escalate, don't route around

Blocked by upstream behaviour with no local workaround? Say so and stop. The
escalation procedure is in `scope.md`.
