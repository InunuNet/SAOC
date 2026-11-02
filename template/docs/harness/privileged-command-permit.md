# Privileged-command permit

An agent that needs `sudo`, `pkexec`, or a file outside the project asks the operator inside the
session, the operator answers one question, and the agent carries on. No terminal switching, no
pasting commands back and forth.

Without a permit the elevation verbs (`sudo doas pkexec run0 su systemd-run sudoedit runuser
machinectl`) are denied by the PreToolUse floor, with a message that says how to ask. Out-of-project
paths behave exactly as before (Claude Code's own prompt decides) unless a path grant covers them.

## The loop

1. **Ask.** The agent runs

   ```
   python3 execution/escalate.py request --kind command --scope pacman,rsync \
       --reason "Omarchy upgrade needs pacman and rsync" --ttl 4h
   python3 execution/escalate.py request --kind path --scope /etc/omarchy \
       --reason "edit the Omarchy config outside the workspace" --ttl 30m
   ```

   `--kind command`: scope is a comma list of bare command names the agent wants to elevate, or
   `*` for any. `--kind path`: scope is one absolute file or directory outside the project.
   Reason is at least 20 characters. TTL is `5m` to `24h` (cap), default `4h`, and `4h` is the
   recommended length. The command writes a pending request under
   `.agent/memory/scratch/escalation/` and prints one `ASKUSERQUESTION: {...}` line.

2. **Answer.** The agent raises that AskUserQuestion with the question text exactly as printed and
   the options `Grant` and `Deny`. The human answers in the session.

3. **Grant.** A PostToolUse(AskUserQuestion) hook runs `python3 execution/escalate.py
   grant-from-answer`. It writes a grant into `.agent/privilege_permit.json` only when the answer
   is exactly `Grant` to that exact question (id, scope and duration lines unchanged, options
   exactly Grant and Deny), the request is under 15 minutes old and untampered (digest), and the
   scope passes the never-grantable list. The request is single use: any answer consumes it.

4. **Act.** Elevated commands and covered paths run until the grant expires. `python3
   execution/escalate.py status` lists live grants and pending requests; `python3
   execution/escalate.py revoke` removes the permit (an agent may narrow its own access).

Providers with no AskUserQuestion (Codex, OpenCode, Grok): `request` also prints a fallback line
`! python3 execution/escalate.py grant <id>`. The operator runs it themselves with the `!` prefix.
It applies the same checks as the hook path. In place of the answer it needs the operator's own
terminal: it opens `/dev/tty` (the agent's Bash tool has none, so it fails closed there, and under
`UNATTENDED`), requires that device to be the controlling terminal of an ancestor CLI (`claude`,
`codex`, `opencode`, `grok`, `agy`, matched through `ps -o tty=`) with no agent tool shell above it,
prints the full scope, reason and duration to it, and writes the permit only after the operator
types the request id back. A pty an agent builds (`pty.fork`) is a fresh device no ancestor owns,
so it is refused, as is a wrong id (the request stays pending). An agent could open the CLI's tty
device as stdin, but it cannot inject keystrokes (no TIOCSTI on macOS, disabled on current Linux),
so that path only prompts the real operator, which is the intended behaviour.

## The permit file

`.agent/privilege_permit.json`, gitignored, re-read on every command:

```json
{"granted_by": "operator:AskUserQuestion",
 "grants": [
   {"id": "ab12cd34", "kind": "command", "commands": ["pacman", "rsync"],
    "created_at": "2026-11-01T12:00:00Z", "expires_at": "2026-11-01T16:00:00Z", "reason": "..."},
   {"id": "ef56ab78", "kind": "path", "path": "/etc/omarchy",
    "created_at": "2026-11-01T12:00:00Z", "expires_at": "2026-11-01T12:30:00Z", "reason": "..."}]}
```

- At most 20 grants. Timestamps are strict `YYYY-MM-DDTHH:MM:SSZ`; the span is at most 24 hours.
- A malformed entry is ignored on its own; a malformed file, a symlink, a directory, a FIFO or an
  oversized file denies everything. Duplicate keys are malformed.
- **Command grant**: `commands` is a list of bare names (no path, space or glob; `"*"` is not a
  wildcard). Absent means any elevated command. With a list, `sudo|doas|pkexec|run0 <name> ...`
  is admitted when `<name>` is on it, bare or from `/usr/bin`, `/usr/sbin`, `/bin`, `/sbin`,
  `/usr/local/bin`, `/usr/local/sbin`. Option parsing is strict: unknown or abbreviated options,
  `-s`, `-i`, `-e`, a bare `sudo`, `su`, `systemd-run`, `machinectl`, `runuser` and `sudoedit` are
  not admitted by a list.
- **Path grant**: an absolute path with no `..` and no glob. Coverage is component-wise on the
  symlink-resolved path, resolved at use time, so a swapped symlink cannot widen it. A granted
  file covers only itself.
- **Never grantable** (at request, at grant and at use): `/`, `$HOME` and its ancestors, `~/.ssh`
  `~/.aws` `~/.gnupg`, any `.env`, `*.pem`, `*.key`, `secrets/`, `.git/`, `.claude/`,
  `autonomy_matrix.json`, the breakglass and emergency files, `check_autonomy.sh`, the hook
  directory, and the permit file.

### Hand-written fallback

If neither route is available the operator can write the file themselves (a hand-written permit
by `granted_by: "<name>"` works the same way). In the session, with the `!` prefix:

```
! python3 -c "import json,datetime as d; n=d.datetime.now(d.timezone.utc); f='%Y-%m-%dT%H:%M:%SZ'; open('.agent/privilege_permit.json','w').write(json.dumps({'granted_by':'brad','grants':[{'id':'00000001','kind':'command','created_at':n.strftime(f),'expires_at':(n+d.timedelta(hours=4)).strftime(f),'reason':'omarchy upgrade'}]}))"
```

An agent cannot create or edit the permit by any route: Write, Edit, shell redirects, `tee`, `cp`,
`mv`, `ln`, `sed -i`, `python -c`, and Routes 1 to 3 naming it are all denied. To revoke by hand,
delete the file.

## What a permit does and does not do

- A permitted verb is a **transparent wrapper**. What it runs is judged exactly as it would be
  without it, so `sudo rm -rf /`, `sudo chmod 777`, `sudo tee .claude/settings.json` and `sudo cat
  ~/.ssh/id_rsa` stay denied. The permit grants elevation, not the floor.
- A permitted command and a fully covered path operation get a PreToolUse `permissionDecision:
  allow` at the final exit, after every floor check, so Claude Code's classifier does not re-block
  what the operator granted. Anything not covered stays silent, exactly today's behaviour.
- Grep and Glob never get an allow decision (a recursive search of a granted directory would surface
  credential-named files inside it); Claude Code's own prompt decides, as before.
- A root shell is never an agent use: `sudo -s`, `sudo -i`, bare `sudo`/`su`/`pkexec`/`doas`/`run0`,
  `runuser` or `machinectl shell` with no command, `systemd-run` with no command, and `sudo sh` or
  `pkexec bash` with no `-c` are denied under every grant, wildcard included.
- Covered-path allows apply to Write, Edit, NotebookEdit, Read, and to Bash commands
  made only of plain file tools (`cat ls cp mv mkdir rm tee grep ...`) whose every out-of-project
  operand is covered. Variables, substitutions, globs, `cd`, `eval` and other commands are never
  covered. Floor-protected names inside a granted directory (`.env`, `*.pem`, `hooks/`,
  `settings.json`, the ssh zone) stay denied.
- Every use is audited, one JSON line per event (`granted denied used path_used revoked`) in
  `.agent/memory/project/privileged_command_audit.log`, commands masked. An audit line that cannot
  be written turns the use into a deny.
- `systemd-run`, `machinectl` and `sudoedit` are payload-opaque: under an open permit they are
  granted wholesale. `.agent/autonomy_matrix.json floor_denials.commands` is inert, enforcement-owned
  and not read by the hook; the hook's verb set is authoritative.

## Passwords

The permit never carries or sees a password. On Linux `pkexec` uses polkit. On macOS use
`SUDO_ASKPASS=execution/sudo_askpass.sh sudo -A <cmd>`: an OS dialog with a hidden answer whose
output goes only to `sudo`. It falls back to `zenity`/`kdialog --password` on Linux. Only the
shipped script path is blessed: an askpass program the agent wrote can phish the password.

## Who can grant

Claude Code, not the model, produces the answer, so the model cannot answer its own question.
Two layers stop an agent from calling the grant code directly:

1. **Lexical.** The floor denies an agent command that runs `escalate.py` (or a copy carrying the
   `ESCALATE_OPERATOR_ONLY` marker) with `grant` or `grant-from-answer`, direct, wrapped, quoted or
   via `sh -c`. `execution/escalate.py` is floor-write-protected. This is defence in depth: the
   real protection of `grant <id>` is the terminal confirmation above.
2. **Ancestry.** `grant-from-answer` walks its own process ancestry (`/bin/ps`, at most 8 hops to
   a `claude` process) and refuses if any ancestor's argv carries `shell-snapshots`, the signature
   of the agent's tool shell. A failed `ps`, an orphan or a daemonised fake `claude` is refused.

## Known residuals

- The grant functions accept an injected process table for tests, but honour it only when the root
  resolves under `.tmp/sandbox/`; for any real root they walk the real `ps`.

- An agent that builds a pty-backed fake `claude` under `setsid` and runs a script the lexical rule
  cannot read; or a marked copy of `escalate.py` with the marker removed, run through
  `runpy`/`importlib`. The AskUserQuestion path is the strong one; the `!` fallback is only as
  strong as the lexical guard.
- Abuse **inside** an allowlisted command (`sudo rsync -e 'sh -c rm' a b`, `sudo pacman -U
  http://...`) runs what the operator allowed. Allowlist narrowly.
- Interpreter and program text is not judged (`python -c os.system(...)`, `sh x.sh`), unchanged
  from before this feature.
- The first answer shape seen live may differ from the two supported ones; when an escalation
  question's answer cannot be parsed, `.agent/memory/scratch/escalation/last_payload_shape.json`
  records the keys and types (no text) and nothing is consumed.

## What this does not stop

The floor and the permit are same-user checks. They govern ordinary agent commands; they do not
contain an agent that deliberately obfuscates interpreter code. State of play, so nobody leans on
them harder than they hold:

- **A forged grant is possible in principle.** `exec python3 -c ...` replaces the agent's tool shell,
  so `hook_ancestry_ok` sees `python3` directly under `claude` with no `shell-snapshots` ancestor. A
  dynamically built import of `privilege_permit` (the module name assembled at run time) passes the
  lexical guard, and could then call `grant_from_answer` with a forged payload. The ancestry check
  and the guard raise the cost of forging a grant; they do not make it impossible.
- **The floor can be fooled by string building.** Probes show the floor returns allow for
  `python3 -c` that builds the permit path or the word `sudo` by string concatenation. This predates
  the permit and applies to every floor rule, not only these.
- **The real boundary for elevation is the operating system**: the sudo password dialog
  (`execution/sudo_askpass.sh`, polkit for `pkexec`) and sudo's own credential cache. A cached sudo
  timestamp means no dialog during its window, so a forged or legitimate grant inside that window
  can elevate without the operator seeing a prompt. Reset it with `sudo -k` when that matters.

Treat the permit as a guard against honest mistakes and casual overreach, with an audit trail, not as
a sandbox.

- **Windows host detection.** The hook strips a trailing CR from canonical paths only when `uname -s` reports MINGW, MSYS or CYGWIN. `uname` resolves through the hook's inherited environment, so a process that controls the hook's own PATH or exported functions could make a POSIX host look like Windows. An agent's Bash tool does not control that environment (the hook is launched by the CLI), and Codex round 3 accepted-as-residual on that basis.

## Windows limits

On a Windows host (Git Bash: `uname -s` MINGW*, MSYS* or CYGWIN*) the floor follows the POSIX outcome for the same path: backslashes become slashes, a trailing CR is stripped, the drive letter of the payload `cwd` is dropped as own drive, any other drive or UNC share maps to `/__foreign_drive__/<name>/`, and names match case-insensitively. A `..` that climbs above a drive or UNC root, own drive included, maps to a sentinel under `/__foreign_drive__/CLIMB/` that is denied before Routes 1 to 3, so no contract, breakglass or emergency file can grant it.

What it does not cover (measured limits, not defects to fix in this release):
- 8.3 short names (`PROGRA~1`) are not expanded.
- NTFS alternate data streams (`file.txt:stream`) are not recognised.
- Reserved device names (`CON`, `NUL`, `COM1`) are not special-cased.
- Junctions and symlinks are not followed when judging a path; the permit file's open uses `O_NOFOLLOW` where the platform has it and a post-open `samestat` check otherwise.
- A payload `cwd` with no drive letter counts every drive as own.
- The host test is `uname -s`; a process that controls the hook's own environment can spoof it.
