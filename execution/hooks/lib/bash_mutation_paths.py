#!/usr/bin/env python3
"""Extract candidate file-mutation target paths from a Bash command string.

Reads the raw shell command on stdin, prints one candidate target path per
line on stdout. Prints nothing when no mutation signature is found -- callers
should treat an empty stdout as "allow, no mutation detected".

Whole-string signature scan, default-allow: this module does not attempt to
fully parse shell grammar. It strips quoted spans and heredoc bodies (so
their contents can never masquerade as a real operator or path) and then
regex-scans for known file-mutation signatures: redirects (>, >>, >|),
tee/tee -a, sed -i/--in-place, cp/mv/install/rsync, git checkout --/restore,
and dd ... of=.
"""
import os
import re
import sys

DEV_TARGETS = {"/dev/null", "/dev/stdout", "/dev/stderr"}
SEP_RE = re.compile(r"&&|\|\||;|\||\n|\)")
HEREDOC_RE = re.compile(r"<<-?\s*(['\"]?)([A-Za-z_][A-Za-z0-9_]*)\1")
REDIRECT_RE = re.compile(r"\d*(>>|>\||>)(?!&)\s*(\S+)")
UTIL_RE = re.compile(r"\b(tee|sed|cp|mv|install|rsync)\b")
GIT_CHECKOUT_RE = re.compile(r"\bgit\s+checkout\s+--\s+(\S+)")
GIT_RESTORE_RE = re.compile(r"\bgit\s+restore\s+(\S+)")
DD_OF_RE = re.compile(r"\bof=(\S+)")
CURL_WGET_RE = re.compile(r"\b(curl|wget)\b")


def blank_heredocs(s: str) -> str:
    out = list(s)
    for m in HEREDOC_RE.finditer(s):
        delim = m.group(2)
        nl = s.find("\n", m.end())
        if nl == -1:
            continue
        body_start = nl + 1
        delim_line = re.compile(r"^[ \t]*" + re.escape(delim) + r"[ \t]*$", re.MULTILINE)
        dm = delim_line.search(s, body_start)
        end = dm.end() if dm else len(s)
        for i in range(body_start, end):
            if out[i] != "\n":
                out[i] = " "
    return "".join(out)


def strip_quotes(s: str) -> str:
    out = []
    i, n = 0, len(s)
    while i < n:
        c = s[i]
        if c == "'":
            j = s.find("'", i + 1)
            j = n - 1 if j == -1 else j
            out.append(" " * (j - i + 1))
            i = j + 1
        elif c == '"':
            j = i + 1
            while j < n and s[j] != '"':
                j += 2 if s[j] == "\\" else 1
            j = min(j, n - 1)
            out.append(" " * (j - i + 1))
            i = j + 1
        else:
            out.append(c)
            i += 1
    return "".join(out)


def segment_after(s: str, start: int) -> str:
    m = SEP_RE.search(s, start)
    end = m.start() if m else len(s)
    return s[start:end]


def clean_path(p: str) -> str:
    return p.rstrip("));&|")


def last_non_flag_token(tokens):
    for tok in reversed(tokens):
        if tok and not tok.startswith("-"):
            return tok
    return None


def first_non_flag_token(tokens):
    for tok in tokens:
        if tok and not tok.startswith("-"):
            return tok
    return None


def curl_wget_candidates(name: str, tokens):
    """Walk the tokens of one curl/wget invocation, yielding every -o/-O/
    --output candidate path (glued, spaced, or bundled into a short-flag
    cluster). Does not stop at the first match -- repeated occurrences of
    the flag each yield their own candidate.
    """
    flag_char = "o" if name == "curl" else "O"
    paths = []
    i = 1
    n = len(tokens)
    while i < n:
        tok = tokens[i]
        if name == "curl" and tok == "--output":
            if i + 1 < n and tokens[i + 1] != "-":
                paths.append(tokens[i + 1])
            i += 2
            continue
        if len(tok) > 1 and tok[0] == "-" and tok[1] != "-":
            idx = tok.find(flag_char, 1)
            if idx != -1:
                remainder = tok[idx + 1:]
                if remainder:
                    if remainder != "-":
                        paths.append(remainder)
                elif i + 1 < n and tokens[i + 1] != "-":
                    paths.append(tokens[i + 1])
        i += 1
    return paths


def curl_remote_name_candidates(tokens):
    """Walk the tokens of one curl invocation, yielding one cwd candidate
    per token that carries a boolean, value-less uppercase -O
    ("--remote-name") anywhere after position 0 of a single-dash cluster.
    This is case-sensitive and independent of the lowercase -o scan --
    -O never consumes a following/glued token as a value.
    """
    matches = 0
    for tok in tokens[1:]:
        if len(tok) > 1 and tok[0] == "-" and tok[1] != "-" and tok.find("O", 1) != -1:
            matches += 1
    return matches


def extract_candidates(command: str):
    cleaned = strip_quotes(blank_heredocs(command))
    paths = []

    for m in REDIRECT_RE.finditer(cleaned):
        target = clean_path(m.group(2))
        if target and target not in DEV_TARGETS:
            paths.append(target)

    for m in UTIL_RE.finditer(cleaned):
        name = m.group(1)
        seg = segment_after(cleaned, m.end())
        tokens = seg.split()
        if name == "tee":
            path = first_non_flag_token(tokens)
        elif name == "sed":
            has_inplace = any(t == "-i" or t == "--in-place" or t.startswith("-i") for t in tokens)
            path = last_non_flag_token(tokens) if has_inplace else None
        else:  # cp, mv, install, rsync
            path = last_non_flag_token(tokens)
        if path:
            paths.append(clean_path(path))

    for m in GIT_CHECKOUT_RE.finditer(cleaned):
        paths.append(clean_path(m.group(1)))

    for m in GIT_RESTORE_RE.finditer(cleaned):
        paths.append(clean_path(m.group(1)))

    for m in DD_OF_RE.finditer(cleaned):
        paths.append(clean_path(m.group(1)))

    for m in CURL_WGET_RE.finditer(cleaned):
        name = m.group(1)
        seg = segment_after(cleaned, m.start())
        tokens = seg.split()
        for path in curl_wget_candidates(name, tokens):
            paths.append(clean_path(path))
        if name == "curl":
            for _ in range(curl_remote_name_candidates(tokens)):
                paths.append(os.getcwd())

    return paths


def main() -> int:
    command = sys.stdin.read()
    for path in extract_candidates(command):
        print(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
