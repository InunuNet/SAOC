#!/usr/bin/env bash
# Stock macOS bash is 3.2: mapfile/readarray, associative arrays (declare/local/
# typeset -A) and ${x,,} ${x^^} ${x,} ${x^} case operators are bash 4+ and kill
# a script there. Only the floor (check_autonomy.sh, which re-execs under bash
# 4+ or denies, and the lib it sources) may use them.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import re, sys
from pathlib import Path
ALLOWED = set()  # the floor is bash 3.2 native since 2026-11-11
BASH4 = [
    (re.compile(r"(?<![\w-])(mapfile|readarray)(?![\w-])"), "mapfile/readarray"),
    (re.compile(r"(?<![\w-])(declare|local|typeset)\s+(-\w+\s+)*-\w*A"), "associative array"),
    (re.compile(r"\$\{#?([A-Za-z_]\w*|[0-9@*])(\[[^]]*\])?(,,?|\^\^?)"), "case-modification expansion"),
    (re.compile(r"\$\{#?[A-Za-z_]\w*\[-[0-9]"), "negative array subscript (bash 4.3+)"),
    (re.compile(r"(?<![\w-])(declare|local|typeset)\s+(-\w+\s+)*-\w*n\b"), "nameref (bash 4.3+)"),
    (re.compile(r"\$\{[A-Za-z_]\w*(?://|/(?!/))(?:\\.|[^/}\\])*/[^}]*\\"), "backslash in a ${x/pat/repl} replacement (bash 3.2 keeps it)"),
    (re.compile(r"\$\{[A-Za-z_]\w*:[^}:]*:-[0-9]"), "negative substring length (bash 4.2+)"),
    (re.compile(r"(\[\[|\[|test)\s+-v\s"), "-v test (bash 4.2+)"),
    (re.compile(r"(?<![\w-])(declare|local|typeset)\s+(-\w+\s+)*-\w*g\b"), "declare -g (bash 4.2+)"),
    (re.compile(r"\$\{[A-Za-z_]\w*@[QEPAaKUuLk]\}"), "${x@op} (bash 4.4+)"),
    (re.compile(r";;&|&>>|\$BASHPID|shopt -s\s+(globstar|lastpipe)"), "bash 4 operator/variable"),
]
SQ = re.compile(r"'[^']*'")
DQ = re.compile(r'"(?:[^"\\$]|\\.)*"')   # double-quoted text without $ expansions
def code_of(line):
    line = SQ.sub("''", line)
    line = DQ.sub('""', line)
    return re.sub(r"(^|\s)#.*$", "", line)
bad = []
for f in sorted(Path("execution").rglob("*.sh")):
    rel = f.as_posix()
    if rel in ALLOWED or "/_archive/" in rel or "/ghost-project/" in rel:
        continue
    heredoc = None
    for n, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
        if heredoc:
            if line.strip() == heredoc:
                heredoc = None
            continue
        m = re.search(r"<<-?\s*['\"]?(\w+)['\"]?", code_of(line))
        for rx, what in BASH4:
            if rx.search(code_of(line)):
                bad.append(f"{rel}:{n}: {what}: {line.strip()[:100]}")
        if m:
            heredoc = m.group(1)
if bad:
    print("FAIL: bash 4+ syntax in execution shell scripts (breaks stock macOS bash 3.2):")
    print("\n".join("  " + b for b in bad)); sys.exit(1)
print("PASS: no bash 4+ syntax in execution shell scripts")
PY
