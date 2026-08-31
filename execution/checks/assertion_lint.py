#!/usr/bin/env python3
"""assertion_lint.py -- lint rules for contract assertion shell commands.

Two rules today, both about assertions whose recorded verdict does not
actually depend on the thing they claim to test:

  vacuous-exit           An assertion's top-level control flow can only ever
                          reach a constant-success statement (echo/printf/
                          true/:), regardless of what its real test evaluates
                          to -- so contract.py's returncode-only verdict
                          always records a pass.
  self-referential-grep  An assertion reads a verifier script's own source
                          (grep/egrep/fgrep/awk/sed/cat) instead of executing
                          it, proving a string is present in a file rather
                          than that the verifier passes.

lint_command(cmd) -> list[dict] is the only public entry point. Each finding
is {"rule": <rule-name>, "message": <human-readable explanation>}.

Both rules parse the shell command with a small quote/`$( )`-aware scanner
(see `_split_top_level`) rather than a regex, so a `&&`/`||`/`|` that occurs
inside a quoted string or a command substitution is never mistaken for a
top-level control operator.
"""
import re
import shlex

RULE_VACUOUS = "vacuous-exit"
RULE_SELF_REF = "self-referential-grep"

# Commands whose exit status is a compile-time constant (0), independent of
# their arguments -- the shapes seen wrapping a real test in the corpus.
CONST_SUCCESS_CMDS = {"echo", "printf", "true", ":"}

# Commands that READ a file's content rather than execute it.
READER_CMDS = {"grep", "egrep", "fgrep", "awk", "sed", "cat"}


def _tokenize(text):
    """Best-effort shell word-splitting. Falls back to a quote-aware regex
    when shlex chokes on unbalanced/unusual quoting rather than raising --
    lint_command must never crash on a live corpus command."""
    try:
        return shlex.split(text, posix=True)
    except ValueError:
        return re.findall(r"""'[^']*'|"[^"]*"|\S+""", text)


def _split_top_level(cmd, ops):
    """Split `cmd` into a list of (text, preceding_operator) pairs, splitting
    only on operators in `ops` (a subset of {'&&', '||', ';', '|'}; ';' also
    matches a bare newline) that occur OUTSIDE any quoting or `$( )` nesting.

    Quoting rules mirror POSIX shell closely enough for the corpus this lints:
      - single quotes are fully literal (no operator, no `$( )`, no escape)
        UNLESS we are directly inside a double-quoted string, where a bare
        `'` is itself just a literal character (real bash semantics -- `'`
        has no special meaning inside "...").
      - `$( )` opens a fresh parsing context even when nested inside an outer
        double-quoted string (real bash: command substitution content is
        re-parsed from scratch), so quotes/operators inside it behave as if
        top-level again.
    """
    stack = []  # entries: 'squote' | 'dquote' | 'paren'
    buf = []
    op = None
    segs = []
    i, n = 0, len(cmd)
    while i < n:
        c = cmd[i]
        top = stack[-1] if stack else None

        if top == "squote":
            buf.append(c)
            if c == "'":
                stack.pop()
            i += 1
            continue

        if c == "\\" and i + 1 < n:
            buf.append(c)
            buf.append(cmd[i + 1])
            i += 2
            continue

        if c == "'" and top != "dquote":
            stack.append("squote")
            buf.append(c)
            i += 1
            continue

        if c == "$" and i + 1 < n and cmd[i + 1] == "(":
            stack.append("paren")
            buf.append("$(")
            i += 2
            continue

        if c == '"':
            if top == "dquote":
                stack.pop()
            else:
                stack.append("dquote")
            buf.append(c)
            i += 1
            continue

        if c == ")" and top == "paren":
            stack.pop()
            buf.append(c)
            i += 1
            continue

        if not stack:
            if "&&" in ops and cmd[i:i + 2] == "&&":
                segs.append(("".join(buf).strip(), op)); buf = []; op = "&&"; i += 2; continue
            if "||" in ops and cmd[i:i + 2] == "||":
                segs.append(("".join(buf).strip(), op)); buf = []; op = "||"; i += 2; continue
            if ";" in ops and c in (";", "\n"):
                segs.append(("".join(buf).strip(), op)); buf = []; op = ";"; i += 1; continue
            if "|" in ops and c == "|" and cmd[i:i + 2] != "||":
                segs.append(("".join(buf).strip(), op)); buf = []; op = "|"; i += 1; continue

        buf.append(c)
        i += 1

    segs.append(("".join(buf).strip(), op))
    return [s for s in segs if s[0]]


def _pipeline_tail(clause):
    """The last stage of a top-level `|` pipeline -- the stage whose exit
    status the pipeline as a whole reports."""
    stages = _split_top_level(clause, {"|"})
    return stages[-1][0] if stages else clause


def _is_const_success_stage(text):
    """True iff the pipeline stage's own command name is a constant-success
    builtin (echo/printf/true/:)."""
    toks = _tokenize(text)
    return bool(toks) and toks[0] in CONST_SUCCESS_CMDS


def _lint_vacuous(cmd):
    """Find the top-level clause that necessarily determines the whole
    command's exit status, and flag it when that clause can only ever
    resolve to a constant-success command.

      - `;`/newline-separated statements run unconditionally in sequence, so
        a trailing constant-success statement always runs last and always
        masks whatever ran before it.
      - within the LAST such statement, `A && B || C` (or a bare `X || Y`)
        masks a real failure once the final `||` fallback resolves to a
        constant-success pipeline tail: whichever of B/C actually runs, the
        reported status is 0.
      - `A && B` alone is NOT vacuous: when A fails, B never runs, and A's
        own (real) exit status propagates untouched.
    """
    clauses = _split_top_level(cmd, {";"})
    if not clauses:
        return None
    last_text, _ = clauses[-1]

    and_or = _split_top_level(last_text, {"&&", "||"})
    if len(and_or) == 1:
        # A trailing constant-success statement only MASKS a real failure
        # when something ran before it. A bare, single, unconditional
        # "true"/"echo x"/":" -- with no `;`/`&&`/`||` anywhere in the
        # command at all -- is a deliberate always-pass placeholder (e.g. a
        # fixture contract used only to exercise unrelated tooling), not a
        # real test whose result is being thrown away.
        if len(clauses) > 1 and _is_const_success_stage(_pipeline_tail(and_or[0][0])):
            return f"trailing statement {and_or[0][0]!r} always runs and always succeeds"
        return None

    last_op = and_or[-1][1]
    tail_text = and_or[-1][0]
    if last_op == "||" and _is_const_success_stage(_pipeline_tail(tail_text)):
        return f'"{last_op} {tail_text}" always succeeds, masking a real failure'
    return None


def _reader_file_operands(cmd_name, args):
    """Extract the FILE operands (not flags, and for the grep family, not
    the search pattern) from a reader command's argument list."""
    non_flags = []
    skip_next = False
    for a in args:
        if skip_next:
            skip_next = False
            continue
        if a.startswith("-") and a != "-":
            if a in ("-e", "-f") and cmd_name in ("grep", "egrep", "fgrep"):
                skip_next = True
            continue
        non_flags.append(a)

    if cmd_name in ("grep", "egrep", "fgrep"):
        return non_flags[1:]  # first non-flag token is the search PATTERN
    if cmd_name == "awk":
        return non_flags[1:]  # first non-flag token is the awk program
    if cmd_name == "sed":
        return non_flags[1:]  # first non-flag token is the sed script
    if cmd_name == "cat":
        return non_flags
    return []


def _is_scoped_verifier_source(path):
    """True iff `path` names a verify_*.py or verify_*.sh file that lives
    under execution/checks/ or any goldens/ directory -- the only places a
    read-instead-of-execute is a genuine self-check rather than an ordinary
    source assertion (execution/verify_agents.sh is a production script that
    merely happens to be named verify_*, and is out of scope)."""
    p = path.strip("'\"")
    if "$" in p:
        return False  # can't resolve a variable reference statically
    name = p.rsplit("/", 1)[-1]
    if not (name.startswith("verify_") and (name.endswith(".py") or name.endswith(".sh"))):
        return False
    return "execution/checks/" in p or p.startswith("goldens/") or "/goldens/" in p


def _lint_self_ref(cmd, depth=0):
    findings = []
    if depth > 4:
        return findings
    clauses = _split_top_level(cmd, {"&&", "||", ";"})
    for text, _op in clauses:
        stages = _split_top_level(text, {"|"})
        for stage_text, _pop in stages:
            toks = _tokenize(stage_text)
            if not toks:
                continue
            # Scan for the reader/wrapper command anywhere in the stage --
            # not just the first token -- so a shell keyword prefix (`do`,
            # `then`, a leading `!` negation) does not hide it.
            i = 0
            while i < len(toks):
                name = toks[i].split("/")[-1]

                if name in ("bash", "sh") and "-c" in toks[i:]:
                    ci = toks.index("-c", i)
                    if ci + 1 < len(toks):
                        findings.extend(_lint_self_ref(toks[ci + 1], depth + 1))
                    i = ci + 2
                    continue

                if name in READER_CMDS:
                    args = toks[i + 1:]
                    for path in _reader_file_operands(name, args):
                        if _is_scoped_verifier_source(path):
                            findings.append({
                                "rule": RULE_SELF_REF,
                                "message": (
                                    f"reads verifier source {path!r} with {name} instead of "
                                    f"executing it -- run it directly (python3/bash {path}) "
                                    "and assert on its own exit code"
                                ),
                            })
                    i = len(toks)  # the rest of the stage is this command's args
                    continue

                i += 1
    return findings


def lint_command(cmd):
    """Lint a single assertion shell command. Returns a list of
    {"rule": str, "message": str} findings; empty when clean."""
    findings = []
    if not cmd or not cmd.strip():
        return findings
    msg = _lint_vacuous(cmd)
    if msg:
        findings.append({"rule": RULE_VACUOUS, "message": msg})
    findings.extend(_lint_self_ref(cmd))
    return findings
