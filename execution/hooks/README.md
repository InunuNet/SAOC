# Hooks

`check_autonomy.sh` is the autonomy floor (PreToolUse). Routes for floor denials:
`.claude/rules/athanor-routes.md`.

## Credential-store raw scan

For Bash, before any wrapper unwrapping or command parsing, the floor normalises the whole
command text (heredoc bodies included: backslash-newline continuations joined, quote characters and backslashes removed, `//` and `/./`
collapsed, lowercased) and denies it, fail closed, when it contains (1) a path component named
`.ssh`, `.aws` or `.gnupg` (`.ssh-fixture` and `foo.aws.json` are not components), or (2) a
home-ish anchor (`~`, `~user`, `$HOME`, `${HOME}`, the HOME value, `/Users/<u>`, `/home/<u>`,
`/root`; not `$PWD`, `~+` or `$(`, so `ls $PWD/*.py` passes) followed by a first component (dotted or not) with a glob, brace
or extglob character (`~/.{ssh,x}`, `~/.*`, `~/@(.[s]sh)`); a `$` before a quote (`$'.'ssh`) is dropped (P52s queue item 20).

Trade-off: a bare relative `.ssh` token (`grep -R '.ssh' docs`) is denied too; rephrase (search for `ssh` without the leading dot, or use the Grep tool). Prose that merely names such a path is denied too; use Edit/Write. A project's own
`.env` is unaffected (`nm_credential_exempt`). Known limit of a text scan: runtime-built strings
(`d=.ssh`, `$'\x2e'`, printf or base64 piped to sh, file-fed paths) are out of scope.
