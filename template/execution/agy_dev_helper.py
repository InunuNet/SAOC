#!/usr/bin/env python3
"""Helper for agy_dev.sh: floor classifier, dev settings, agy JSON parser.

    agy_dev_helper.py floor              NUL-separated paths on stdin; prints each floor-protected one, exit 1 if any
    agy_dev_helper.py home               prints the OS-account home (not $HOME)
    agy_dev_helper.py settings WT        prints the edit-only deny settings JSON for worktree WT
    agy_dev_helper.py parse OUT RESP     reads agy stdout JSON OUT, writes the response to RESP,
                                         prints key=value lines (status, tokens, denied, ...)

The floor classifier is NOT a copy: it reads the case patterns of floor_glob_match() out of
execution/hooks/check_autonomy.sh, so the hook stays the single source of truth.
"""

import fnmatch
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hooks", "check_autonomy.sh")
FUNC_RE = re.compile(r'floor_glob_match\(\)\s*\{\s*case "\$1" in(.*?)\)\s*return 0', re.S)
EXIT_USAGE = 2
CREDENTIAL_DIRS = (".ssh", ".aws", ".gnupg", ".claude", ".config")
PROTECTED_WRITE_GLOBS = (
    ".git/*", "execution/hooks/*", ".claude/*", ".agent/autonomy_matrix.json",
    ".agent/enforcement_breakglass.json", ".agent/privilege_permit.json",
    "execution/escalate.py", "CLAUDE.md", "AGENTS.md", "GEMINI.md", "init.sh",
    "full_boot.sh", "**/.env", "**/*.pem", "**/*.key", "**/secrets/*",
)


def floor_patterns():
    with open(HOOK, encoding="utf-8") as fh:
        match = FUNC_RE.search(fh.read())
    if not match:
        sys.exit("agy_dev_helper: floor_glob_match() not found in %s" % HOOK)
    body = match.group(1).replace("\\\n", "")
    patterns = [p.strip() for p in body.split("|") if p.strip()]
    if not patterns:
        sys.exit("agy_dev_helper: no floor patterns parsed from %s" % HOOK)
    return patterns


def is_protected(path, patterns):
    # Case-insensitive: APFS and NTFS are, and the hook uses nocasematch on Windows.
    path = path.lower()
    if ".git" in path.replace("\\", "/").split("/"):   # the bare .git pointer file too
        return True
    candidates = (path, "/" + path.lstrip("/"))
    return any(fnmatch.fnmatchcase(c, p.lower()) for c in candidates for p in patterns)


def cmd_floor():
    patterns = floor_patterns()
    raw = sys.stdin.buffer.read().decode("utf-8", "surrogateescape")
    paths = [p.replace("\\", "/") for p in raw.split("\0") if p]
    hits = [p for p in paths if is_protected(p, patterns)]
    for hit in hits:
        sys.stdout.buffer.write((hit + "\n").encode("utf-8", "surrogateescape"))
    return 1 if hits else 0


def real_home():
    """The account's home from the OS, never from $HOME (the caller's env is not trusted)."""
    try:
        import pwd
        return pwd.getpwuid(os.getuid()).pw_dir
    except ImportError:   # Windows: no pwd; USERPROFILE via expanduser
        return os.path.expanduser("~")


def cmd_settings(wt):
    wt = wt.replace("\\", "/").rstrip("/")
    home = real_home().replace("\\", "/")
    deny = ["command(*)", "mcp(*)", "execute_url(*)", "download_url(*)", "read_url(*)"]
    deny += ["write_file(%s/%s)" % (wt, g) for g in PROTECTED_WRITE_GLOBS]
    for name in CREDENTIAL_DIRS:
        for action in ("read_file", "write_file"):
            deny.append("%s(%s/%s/*)" % (action, home, name))
    deny += ["read_file(**/.env)", "write_file(**/.env)"]
    print(json.dumps({"permissions": {"deny": deny}}))
    return 0


def cmd_parse(out_path, resp_path):
    try:
        with open(out_path, encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict):
            raise ValueError("not an object")
    except (OSError, ValueError):
        print("valid=0")
        return 0
    usage = data.get("usage") or {}
    with open(resp_path, "w", encoding="utf-8") as fh:
        fh.write(str(data.get("response") or ""))
    denied = data.get("denied_actions") or []
    rows = {
        "valid": 1,
        "status": data.get("status", ""),
        "finished_reason": data.get("finished_reason", ""),
        "error": re.sub(r"\s+", " ", str(data.get("error", "")))[:300],
        "denied": ",".join(str(d.get("action", "?")) for d in denied if isinstance(d, dict)),
        "tokens_in": usage.get("input_tokens", 0),
        "tokens_out": usage.get("output_tokens", 0),
        "tokens_thinking": usage.get("thinking_tokens", 0),
        "tokens_cache_read": usage.get("cache_read_tokens", 0),
        "tokens_total": usage.get("total_tokens", 0),
    }
    for key, val in rows.items():
        print("%s=%s" % (key, val))
    return 0


def cmd_codex_run(binary, wt, model, last_message, timeout, prompt):
    """Invoke Codex with an argv list and an enforced wall timeout."""
    match = re.fullmatch(r"([0-9]+)([smh])", timeout)
    if not match or int(match.group(1)) == 0:
        sys.stderr.write("codex_dev: timeout must be a positive duration (s, m or h)\n")
        return EXIT_USAGE
    seconds = int(match.group(1)) * {"s": 1, "m": 60, "h": 3600}[match.group(2)]
    if os.name == "nt":
        resolved = shutil.which(binary)
        if resolved is None:
            sys.stderr.write("codex_dev: cannot start codex: %s not found\n" % binary)
            return 127
        binary = resolved
        if not binary.lower().endswith((".exe", ".cmd", ".bat", ".com")):
            try:
                with open(binary, "rb") as fh:
                    shebang = fh.read(2) == b"#!"
            except OSError as exc:
                sys.stderr.write("codex_dev: cannot start codex: %s\n" % exc)
                return 127
            if shebang:
                bash = shutil.which("bash")
                if bash is None:
                    sys.stderr.write("codex_dev: cannot start codex: bash not found\n")
                    return 127
                binary = [bash, binary]
    argv = (binary if isinstance(binary, list) else [binary]) + [
            "exec", "-C", wt, "-s", "workspace-write", "-m", model,
            "--skip-git-repo-check", "-o", last_message, prompt]
    try:
        kwargs = ({"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
                  if os.name == "nt" else {"start_new_session": True})
        process = subprocess.Popen(argv, stdin=subprocess.DEVNULL, **kwargs)
        try:
            return process.wait(timeout=seconds)
        except subprocess.TimeoutExpired:
            if os.name == "nt":
                subprocess.run(["taskkill", "/T", "/F", "/PID", str(process.pid)],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               check=False)
            else:
                deadline = time.monotonic() + 2
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=max(0, deadline - time.monotonic()))
                except subprocess.TimeoutExpired:
                    pass
                remaining = deadline - time.monotonic()
                if remaining > 0:
                    time.sleep(remaining)
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.wait()
            sys.stderr.write("codex_dev: timed out after %s\n" % timeout)
            return 124
    except OSError as exc:
        sys.stderr.write("codex_dev: cannot start codex: %s\n" % exc)
        return 127


def main(argv):
    if len(argv) == 2 and argv[1] == "home":
        print(real_home())
        return 0
    if len(argv) >= 2 and argv[1] == "floor":
        return cmd_floor()
    if len(argv) == 3 and argv[1] == "settings":
        return cmd_settings(argv[2])
    if len(argv) == 4 and argv[1] == "parse":
        return cmd_parse(argv[2], argv[3])
    if len(argv) == 8 and argv[1] == "codex-run":
        return cmd_codex_run(*argv[2:])
    sys.stderr.write(__doc__)
    return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main(sys.argv))
