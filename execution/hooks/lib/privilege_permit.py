#!/usr/bin/env python3
"""privilege_permit.py -- the operator permit for elevated commands and out-of-project paths.

One file shared by three callers, so the rules cannot drift apart:

  check_autonomy.sh   `use`, `parse`, `audit-used`, `path-use`: decide whether a sudo-class command
                      or an out-of-project path is covered by a live grant in
                      .agent/privilege_permit.json, and write the audit line.
  escalate.py         imports the validators, `grant_from_answer` (the PostToolUse(AskUserQuestion)
                      entry point: the human's answer is the only thing that creates a grant) and
                      `process_request` (the operator's `grant <id>` fallback).

Design: docs/privileged-command-permit.md. Every function fails closed: an unreadable permit, an
unparseable option or an unwritable audit log is a deny, never an allow.
"""
import fcntl
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from collections import namedtuple
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

PERMIT_REL = ".agent/privilege_permit.json"
AUDIT_REL = ".agent/memory/project/privileged_command_audit.log"
PENDING_REL = ".agent/memory/scratch/escalation"
GRANTED_BY_ANSWER = "operator:AskUserQuestion"
GRANTED_BY_FALLBACK = "operator:escalate.py grant"
CLI_NAMES = frozenset(("claude", "codex", "opencode", "grok", "agy"))
NO_TTY = ("", "?", "??")
UNATTENDED_REL = ".agent/memory/scratch/UNATTENDED"
MAX_TYPED = 256
SHAPE_FILE = "last_payload_shape.json"
SHAPE_KEY_RE = re.compile(r"[A-Za-z_]{1,30}")
SHAPE_DEPTH = 6

MAX_GRANTS = 20
MAX_GRANT_SECONDS = 24 * 3600
MIN_TTL_SECONDS = 300
PENDING_MAX_AGE = 15 * 60
CLOCK_SKEW_SECONDS = 60
MAX_FILE_BYTES = 256 * 1024
MAX_STDIN_BYTES = 1024 * 1024
MAX_COMMANDS = 64
MAX_FIELD = 200
MAX_COMMAND_LOG = 300
MAX_HOPS = 16
CLAUDE_HOP_LIMIT = 8
PS_TIMEOUT = 10
MIN_REASON = 20
ISO_RE = re.compile(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
ID_RE = re.compile(r"[0-9a-f]{8}")
VERB_NAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._+-]*")
ESC_TOKEN_RE = re.compile(r"\[escalation ([0-9a-f]{8})\]")
TTL_RE = re.compile(r"([0-9]+)([mh])")
ASSIGN_RE = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")

ELEVATION_VERBS = ("sudo", "doas", "pkexec", "run0", "su", "systemd-run", "sudoedit", "runuser",
                   "machinectl")
ALLOWLISTABLE_VERBS = ("sudo", "doas", "pkexec", "run0")
SYSTEM_DIRS = ("/usr/bin", "/usr/sbin", "/bin", "/sbin", "/usr/local/bin", "/usr/local/sbin")

NEVER_DIRS = frozenset((".ssh", ".aws", ".gnupg", "secrets", ".git", ".claude"))
NEVER_NAMES = frozenset((".env", ".sops.yaml", "autonomy_matrix.json",
                         "enforcement_breakglass.json", "enforcement_emergency.json",
                         "check_autonomy.sh", "privilege_permit.json"))
NEVER_SUFFIXES = (".pem", ".key")

Proc = namedtuple("Proc", "pid ppid args tty", defaults=("",))


class Refusal(Exception):
    """A request, grant or use that must not proceed; the message is the reason."""


# ---------------------------------------------------------------------------------------------
# time and small validators


def utcnow(now=None):
    return now if now is not None else datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value):
    """Strict `YYYY-MM-DDTHH:MM:SSZ` only; anything else is None."""
    if not isinstance(value, str) or not ISO_RE.fullmatch(value):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_ttl(text):
    match = TTL_RE.fullmatch(text.strip()) if isinstance(text, str) else None
    if not match:
        raise Refusal("ttl must look like 30m or 4h (5m to 24h), got %r" % (text,))
    seconds = int(match.group(1)) * (3600 if match.group(2) == "h" else 60)
    if not MIN_TTL_SECONDS <= seconds <= MAX_GRANT_SECONDS:
        raise Refusal("ttl must be between 5m and 24h, got %r" % (text,))
    return seconds


def format_ttl(seconds):
    return "%dh" % (seconds // 3600) if seconds % 3600 == 0 else "%dm" % (seconds // 60)


def clean(value, limit=MAX_FIELD):
    """A string safe to put in a one-line field: control characters become spaces, then cut."""
    text = value if isinstance(value, str) else str(value)
    return re.sub(r"[\x00-\x1f\x7f]", " ", text)[:limit]


def digest_of(kind, scope, ttl_seconds, reason):
    blob = "%s|%s|%s|%s" % (kind, scope, ttl_seconds, reason)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def question_text(request_id, kind, scope, reason, ttl_seconds):
    return ("[escalation %s] Grant %s escalation?\nScope: %s\nReason: %s\nDuration: %s"
            % (request_id, kind, scope, reason, format_ttl(ttl_seconds)))


# ---------------------------------------------------------------------------------------------
# files: bounded, no-follow reads and the audit log


def read_regular(path, limit=MAX_FILE_BYTES):
    """Read a regular file without following a symlink or blocking on a FIFO; raise otherwise."""
    flags = os.O_RDONLY | os.O_NOFOLLOW | getattr(os, "O_NONBLOCK", 0)
    fd = os.open(str(path), flags)
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("not a regular file")
        if info.st_size > limit:
            raise ValueError("file larger than %d bytes" % limit)
        chunks = []
        while True:
            chunk = os.read(fd, 65536)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks).decode("utf-8")
    finally:
        os.close(fd)


def _reject_constant(name):
    raise ValueError("bad json constant %s" % name)


def _no_duplicates(pairs):
    out = {}
    for key, val in pairs:
        if key in out:
            raise ValueError("duplicate key %s" % key)
        out[key] = val
    return out


def load_json_strict(text):
    if "\r" in text:
        raise ValueError("carriage return in json")
    return json.loads(text, parse_constant=_reject_constant, object_pairs_hook=_no_duplicates)


def audit_append(root, event, **fields):
    """Append one JSON line to the audit log; False when it cannot land (callers then deny)."""
    record = {"ts": iso(utcnow()), "event": event}
    for key, val in fields.items():
        record[key] = clean(val, MAX_COMMAND_LOG if key in ("command", "path") else MAX_FIELD)
    line = json.dumps(record, ensure_ascii=True) + "\n"
    log = Path(root) / AUDIT_REL
    try:
        log.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(str(log), os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o644)
        try:
            os.write(fd, line.encode("ascii"))
        finally:
            os.close(fd)
    except OSError:
        return False
    return True


# ---------------------------------------------------------------------------------------------
# never-grantable list and scope validation


def canon(path):
    return os.path.realpath(path)


def _home_forms():
    raw = os.environ.get("HOME") or os.path.expanduser("~")
    return {os.path.normpath(raw), canon(raw)}


def nongrantable(path):
    """Why `path` can never be covered by a grant, or '' when it can. `path` is resolved."""
    parts = [p for p in path.split("/") if p]
    if not parts:
        return "the filesystem root"
    low = [p.lower() for p in parts]
    if any(p in NEVER_DIRS for p in low):
        return "credential or machinery directory"
    if any(p in NEVER_NAMES or p.startswith(".env.") for p in low):
        return "credential or enforcement file"
    if low[-1].endswith(NEVER_SUFFIXES):
        return "key material"
    if any(a == "execution" and b == "hooks" for a, b in zip(low, low[1:])):
        return "the hook directory"
    base = path.rstrip("/")
    for home in _home_forms():
        if base == home or home.startswith(base + "/"):
            return "the home directory or one of its ancestors"
    return ""


def validate_command_scope(scope):
    """List of verbs, or None for '*' (any command)."""
    if not isinstance(scope, str) or not scope.strip():
        raise Refusal("a command scope is a comma list of bare commands such as pacman,rsync, or *")
    if scope.strip() == "*":
        return None
    verbs = [v.strip() for v in scope.split(",")]
    if len(verbs) > MAX_COMMANDS or any(not VERB_NAME_RE.fullmatch(v) for v in verbs):
        raise Refusal("command scope entries must be bare names (no path, space or glob): %r" % scope)
    return list(dict.fromkeys(verbs))


def validate_path_scope(scope, root):
    """The resolved absolute path for a path grant, or raise Refusal."""
    if not isinstance(scope, str) or not scope.startswith("/"):
        raise Refusal("a path scope must be an absolute path")
    if re.search(r"[\x00-\x1f*?\[]", scope) or ".." in scope.split("/"):
        raise Refusal("a path scope has no '..', glob or control characters")
    resolved = canon(scope)
    for form in (scope, resolved):
        why = nongrantable(os.path.normpath(form))
        if why:
            raise Refusal("%s can never be granted (%s)" % (scope, why))
    root_real = canon(str(root))
    if resolved == root_real or resolved.startswith(root_real + "/"):
        raise Refusal("%s is inside the project; no permit is needed there" % scope)
    return resolved


def validate_scope(kind, scope, root):
    """Normalised scope string for a request: comma list / '*' for commands, real path for paths."""
    if kind == "command":
        verbs = validate_command_scope(scope)
        return "*" if verbs is None else ",".join(verbs)
    if kind == "path":
        return validate_path_scope(scope, root)
    raise Refusal("kind must be command or path, got %r" % (kind,))


# ---------------------------------------------------------------------------------------------
# the permit


def _valid_command_list(value):
    if (not isinstance(value, list) or not value or len(value) > MAX_COMMANDS
            or any(not isinstance(v, str) or not VERB_NAME_RE.fullmatch(v) for v in value)):
        raise ValueError("bad commands list")
    return frozenset(value)


def _valid_path_grant(path):
    if (not isinstance(path, str) or not path.startswith("/") or re.search(r"[\x00-\x1f*?\[]", path)
            or ".." in path.split("/")):
        raise ValueError("bad path grant")
    if nongrantable(os.path.normpath(path)) or nongrantable(canon(path)):
        raise ValueError("never-grantable path")
    return path


def _grant_window_ok(entry, now):
    created, expires = parse_iso(entry.get("created_at")), parse_iso(entry.get("expires_at"))
    if created is None or expires is None:
        return False
    span = (expires - created).total_seconds()
    if span <= 0 or span > MAX_GRANT_SECONDS:
        return False
    return created <= now + timedelta(seconds=CLOCK_SKEW_SECONDS) and expires > now


def _valid_grant(entry, now):
    """A normalised grant dict, or None when this one entry is malformed, expired or not yet valid."""
    if not isinstance(entry, dict) or entry.get("kind") not in ("command", "path"):
        return None
    if not _grant_window_ok(entry, now):
        return None
    ident = entry.get("id", "-")
    if not isinstance(ident, str) or not ident:
        return None
    grant = {"id": clean(ident, 64), "kind": entry["kind"], "expires_at": entry["expires_at"],
             "created_at": entry["created_at"], "commands": None, "path": None}
    try:
        if entry["kind"] == "command":
            if "path" in entry:
                return None
            if "commands" in entry:
                grant["commands"] = _valid_command_list(entry["commands"])
        else:
            if "commands" in entry:
                return None
            grant["path"] = _valid_path_grant(entry.get("path"))
    except ValueError:
        return None
    return grant


def load_permit_doc(root):
    """The parsed permit document. Raises on a missing, symlinked, non-regular or malformed file."""
    doc = load_json_strict(read_regular(Path(root) / PERMIT_REL))
    if not isinstance(doc, dict):
        raise ValueError("permit is not an object")
    return doc


def load_permit(root, now=None):
    """(granted_by, [normalised live grants]) or None when there is no usable permit."""
    now = utcnow(now)
    try:
        doc = load_permit_doc(root)
    except (OSError, ValueError, UnicodeDecodeError):
        return None
    granted_by = doc.get("granted_by")
    grants = doc.get("grants")
    if (not isinstance(granted_by, str) or not granted_by.strip()
            or not isinstance(grants, list) or len(grants) > MAX_GRANTS):
        return None
    live = [g for g in (_valid_grant(e, now) for e in grants) if g is not None]
    return (clean(granted_by), live) if live else None


# ---------------------------------------------------------------------------------------------
# option parsing for the elevation verbs


def _walk_options(args, short_bool, short_val, long_bool, long_val):
    """(index of the first operand, set of flags seen) or None on any unknown option."""
    i, n, seen = 0, len(args), set()
    while i < n:
        word = args[i]
        if word == "--":
            return i + 1, seen
        if word.startswith("--"):
            name, eq, _ = word[2:].partition("=")
            seen.add(name)
            if name in long_val:
                i += 1 if eq else 2
            elif name in long_bool and (not eq or name == "preserve-env"):
                i += 1
            else:
                return None
        elif word.startswith("-") and len(word) > 1:
            i += 1
            for j, char in enumerate(word[1:], 1):
                seen.add(char)
                if char in short_val:
                    i += 0 if j + 1 < len(word) else 1
                    break
                if char not in short_bool:
                    return None
        else:
            return i, seen
        if i > n:
            return None
    return i, seen


SUDO_SPEC = (set("AbEHKknPSsiBelVv"), set("uCghprtUTDR"),
             {"askpass", "background", "bell", "edit", "help", "list", "login", "non-interactive",
              "preserve-env", "reset-timestamp", "remove-timestamp", "set-home", "shell", "stdin",
              "validate", "version"},
             {"user", "group", "close-from", "chdir", "chroot", "command-timeout", "other-user",
              "prompt", "role", "type", "host"})
DOAS_SPEC = (set("ns"), set("uC"), set(), set())
PKEXEC_SPEC = (set(), set(), {"disable-internal-agent", "version", "help", "keep-cwd"}, {"user"})
RUN0_SPEC = (set(), set("ugD"), {"no-ask-password", "pty", "no-pty", "pipe", "empower",
                                 "same-root-dir", "help", "version"},
             {"user", "group", "chdir", "property", "description", "setenv", "unit", "slice",
              "nice", "machine", "background"})
SPECS = {"sudo": SUDO_SPEC, "doas": DOAS_SPEC, "pkexec": PKEXEC_SPEC, "run0": RUN0_SPEC}
NO_COMMAND_FLAGS = {"l", "list", "version", "V", "validate", "v", "help"}
EDIT_FLAGS = {"e", "edit"}
SHELL_FLAGS = {"s", "i", "shell", "login"}


def _command_after_options(verb, args):
    walked = _walk_options(args, *SPECS[verb])
    if walked is None:
        return None
    idx, seen = walked
    inner = list(args[idx:])
    while verb == "sudo" and inner and ASSIGN_RE.match(inner[0]):
        inner.pop(0)
    if verb == "sudo" and seen & EDIT_FLAGS:
        return ("edit", inner) if inner else ("none", None)
    if seen & NO_COMMAND_FLAGS:
        return ("none", None)
    if seen & SHELL_FLAGS:
        return ("bare", None)
    return ("words", inner) if inner else ("bare", None)


def _shell_c_value(args):
    """The command string handed to `-c` / `--command`, or None."""
    for i, word in enumerate(args):
        if word == "--":
            return None
        if word.startswith("--command="):
            return word[len("--command="):]
        if word == "--command" and i + 1 < len(args):
            return args[i + 1]
        if word.startswith("-") and not word.startswith("--") and "c" in word:
            tail = word.split("c", 1)[1]
            if tail:
                return tail
            if i + 1 < len(args):
                return args[i + 1]
    return None


def _runuser_words(args):
    for i, word in enumerate(args):
        if word == "-u" and i + 2 <= len(args):
            rest = args[i + 2:]
            if rest and rest[0] == "--":
                rest = rest[1:]
            return ("words", rest) if rest else ("bare", None)
    return None


SYSTEMD_RUN_SPEC = (set("tPqG"), set("puEMH"),
                    {"scope", "user", "system", "pty", "pipe", "wait", "collect", "no-block",
                     "quiet", "send-sighup", "no-ask-password", "same-dir", "shell", "help"},
                    {"property", "unit", "description", "slice", "setenv", "working-directory",
                     "machine", "host", "uid", "gid", "nice", "service-type", "on-active",
                     "on-boot", "on-startup", "on-unit-active", "on-unit-inactive", "on-calendar",
                     "timer-property"})


def _systemd_run_words(args):
    """Options up to the first operand are skipped; the command that follows is kept verbatim."""
    walked = _walk_options(args, *SYSTEMD_RUN_SPEC)
    if walked is None:
        return None
    rest = list(args[walked[0]:])
    return ("words", rest) if rest else ("bare", None)


def _machinectl_words(args):
    """`machinectl shell [USER@]HOST [COMMAND [ARGS...]]` runs COMMAND verbatim; others are opaque."""
    operands = [a for a in args if not a.startswith("-")]
    if not operands or operands[0] != "shell":
        return ("none", None)
    at = args.index("shell")
    rest = list(args[at + 2:])
    return ("words", rest) if rest else ("bare", None)


def _sudoedit_targets(args):
    walked = _walk_options(args, *SUDO_SPEC)
    if walked is None:
        return None
    rest = list(args[walked[0]:])
    return ("edit", rest) if rest else ("none", None)


def parse_elevation(verb, args):
    """('words'|'shell'|'none', payload) describing what the verb will run, or None if unparseable."""
    if verb in SPECS:
        return _command_after_options(verb, args)
    if verb in ("su", "runuser"):
        value = _shell_c_value(args)
        if value is not None:
            return ("shell", value)
        return (_runuser_words(args) if verb == "runuser" else None) or ("bare", None)
    if verb == "systemd-run":
        return _systemd_run_words(args)
    if verb == "sudoedit":
        return _sudoedit_targets(args)
    if verb == "machinectl":
        return _machinectl_words(args)
    return None


def inner_command_name(word):
    """Bare name of the inner command, or None when it comes from outside the system bin dirs."""
    if "/" not in word:
        return word
    directory, _, base = word.rpartition("/")
    return base if directory in SYSTEM_DIRS else None


def _admits(grant, verb, parsed, mode):
    if grant["kind"] != "command":
        return False
    if grant["commands"] is None:
        return True
    if mode != "run" or verb not in ALLOWLISTABLE_VERBS or parsed[0] != "words":
        return False
    name = inner_command_name(parsed[1][0])
    return name is not None and name in grant["commands"]


def decide_use(root, verb, args, mode="run", now=None):
    """(status, grant, granted_by, parsed): status 'ok' or 'deny:<why>'."""
    permit = load_permit(root, now)
    if permit is None:
        return "deny:no valid permit", None, "", None
    granted_by, grants = permit
    parsed = ("none", None) if mode == "link" else parse_elevation(verb, args)
    if parsed is None:
        return "deny:could not parse the options of %s" % verb, None, "", None
    if parsed[0] == "bare":
        return "deny:an interactive root shell is never an agent use", None, "", None
    if parsed[0] == "edit":
        for target in parsed[1]:
            path = os.path.expanduser(target)
            if nongrantable(canon(path if os.path.isabs(path) else os.path.join(str(root), path))):
                return "deny:%s is a protected edit target" % clean(target, 80), None, "", None
    for grant in grants:
        if _admits(grant, verb, parsed, mode):
            return "ok", grant, granted_by, parsed
    return "deny:no grant covers this command", None, "", None


# ---------------------------------------------------------------------------------------------
# path coverage


def covering_grant(root, target, now=None):
    """The live path grant covering `target`, or None. Everything is resolved at use time."""
    permit = load_permit(root, now)
    if permit is None:
        return None
    resolved = canon(target if os.path.isabs(target) else os.path.join(str(root), target))
    if nongrantable(resolved):
        return None
    for grant in permit[1]:
        if grant["kind"] != "path":
            continue
        base = canon(grant["path"])
        if nongrantable(base):
            continue
        if resolved == base or resolved.startswith(base.rstrip("/") + "/"):
            return grant
    return None


# ---------------------------------------------------------------------------------------------
# pending requests and the grant


def pending_dir(root):
    return Path(root) / PENDING_REL


def load_pending(root, request_id):
    """The parsed pending request for `request_id`; raises Refusal when absent or unreadable."""
    if not ID_RE.fullmatch(request_id):
        raise Refusal("bad request id")
    try:
        doc = load_json_strict(read_regular(pending_dir(root) / (request_id + ".json")))
    except (OSError, ValueError, UnicodeDecodeError) as exc:
        raise Refusal("no readable pending request (%s)" % type(exc).__name__)
    if not isinstance(doc, dict):
        raise Refusal("pending request is not an object")
    return doc


def validate_pending(doc, request_id, root, now):
    """Re-apply every rule the request applied; returns (kind, scope, ttl_seconds, reason)."""
    kind, scope, reason = doc.get("kind"), doc.get("scope"), doc.get("reason")
    ttl = doc.get("ttl_seconds")
    if doc.get("id") != request_id or not isinstance(ttl, int) or isinstance(ttl, bool):
        raise Refusal("pending request has a bad id or ttl")
    if not isinstance(reason, str) or not isinstance(scope, str):
        raise Refusal("pending request has a bad scope or reason")
    if digest_of(kind, scope, ttl, reason) != doc.get("digest"):
        raise Refusal("pending request was altered after it was made")
    requested = parse_iso(doc.get("requested_at"))
    if requested is None:
        raise Refusal("pending request has no valid time")
    age = (now - requested).total_seconds()
    if age < -CLOCK_SKEW_SECONDS or age > PENDING_MAX_AGE:
        raise Refusal("pending request is stale")
    if not MIN_TTL_SECONDS <= ttl <= MAX_GRANT_SECONDS or len(reason.strip()) < MIN_REASON:
        raise Refusal("pending request ttl or reason out of range")
    if validate_scope(kind, scope, root) != scope:
        raise Refusal("pending request scope is not in its normal form")
    return kind, scope, ttl, reason


def consume_pending(root, request_id):
    """Atomically take the pending request out of play (single use); Refusal if already gone."""
    src = pending_dir(root) / (request_id + ".json")
    dst = pending_dir(root) / (".consumed-%s-%d" % (request_id, os.getpid()))
    try:
        os.rename(str(src), str(dst))
    except OSError:
        raise Refusal("request already consumed or missing")
    try:
        os.unlink(str(dst))
    except OSError:
        pass


def _option_labels(question):
    options = question.get("options")
    if not isinstance(options, list):
        return None
    return [opt.get("label") if isinstance(opt, dict) else opt for opt in options]


def extract_answer(response, question):
    """The human's answer to `question` from either realistic tool_response shape, or None."""
    if isinstance(response, dict):
        answers = response.get("answers")
        if isinstance(answers, dict):
            value = answers.get(question)
            return value if isinstance(value, str) else None
        if isinstance(answers, list):
            for item in answers:
                if isinstance(item, dict) and item.get("question") == question:
                    value = item.get("answer")
                    return value if isinstance(value, str) else None
        return None
    if isinstance(response, str):
        marker = '"%s"="' % question
        at = response.find(marker)
        if at < 0:
            return None
        rest = response[at + len(marker):]
        for label in ("Grant", "Deny"):
            if rest.startswith(label + '"') and re.match(r'(\. You can|, "|\.?$)',
                                                        rest[len(label) + 1:]):
                return label
        return rest.split('"', 1)[0]
    return None


def read_process_table():
    for ps in ("/bin/ps", "/usr/bin/ps"):
        if os.path.exists(ps):
            break
    else:
        return []
    try:
        out = subprocess.run([ps, "-A", "-ww", "-o", "pid=,ppid=,tty=,args="], capture_output=True,
                             text=True, timeout=PS_TIMEOUT, check=True).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    rows = []
    for line in out.splitlines():
        match = re.match(r"\s*([0-9]+)\s+([0-9]+)\s+(\S+)\s+(.*)$", line)
        if match:
            rows.append(Proc(int(match.group(1)), int(match.group(2)), match.group(4),
                             match.group(3)))
    return rows


def _is_cli(args, names):
    words = args.split()
    return bool(words) and os.path.basename(words[0]) in names


def sandbox_root(root):
    """True when `root` resolves under a `.tmp/sandbox/` directory: the only place an injected
    process table is honoured. A permit minted there is never read by a real project's floor."""
    parts = Path(os.path.realpath(str(root))).parts
    return any(a == ".tmp" and b == "sandbox" for a, b in zip(parts, parts[1:]))


def _ancestry(chain):
    """[self, parent, ...] from the process table (the real ps when chain is None); [] when the
    table is empty or does not hold us. A pid that appears twice ends the walk."""
    rows = chain if chain is not None else read_process_table()
    if not rows:
        return []
    by_pid = {}
    for row in rows:
        by_pid.setdefault(row.pid, []).append(row)
    cur = rows[0].pid if chain is not None else os.getpid()
    walked, seen = [], set()
    for _ in range(MAX_HOPS):
        found = by_pid.get(cur)
        if not found or len(found) != 1 or cur in seen:
            break
        row = found[0]
        seen.add(cur)
        walked.append(row)
        if row.ppid <= 1:
            break
        cur = row.ppid
    return walked


def hook_ancestry_ok(chain=None):
    """True only when a `claude` process is within CLAUDE_HOP_LIMIT hops above us and no ancestor
    is the agent's tool shell (argv carrying `shell-snapshots`). Any doubt is False."""
    walked = _ancestry(chain)
    if not walked or any("shell-snapshots" in row.args for row in walked):
        return False
    return any(_is_cli(row.args, ("claude",)) for row in walked[1:CLAUDE_HOP_LIMIT + 1])


def tty_name_of(tty_fd):
    """The device name the way `ps -o tty=` prints it: ttys003, pts/2."""
    name = os.ttyname(tty_fd)
    return name[len("/dev/"):] if name.startswith("/dev/") else name


def cli_tty_ok(tty_fd, chain=None):
    """True only when `tty_fd` is the controlling terminal of an ancestor CLI (claude, codex,
    opencode, grok, agy). A pty an agent built is a fresh device no ancestor owns; an agent tool
    shell anywhere above us refuses outright."""
    walked = _ancestry(chain)
    if not walked or any("shell-snapshots" in row.args for row in walked):
        return False
    try:
        mine = tty_name_of(tty_fd)
    except OSError:
        return False
    return any(_is_cli(row.args, CLI_NAMES) and row.tty not in NO_TTY and row.tty == mine
               for row in walked[1:CLAUDE_HOP_LIMIT + 1])


def _existing_grants(root, now, default_by):
    """(raw live grant entries to keep, file-level granted_by) from the current permit file."""
    permit_path = Path(root) / PERMIT_REL
    try:
        doc = load_permit_doc(root)
    except FileNotFoundError:
        return [], default_by
    except (OSError, ValueError, UnicodeDecodeError):
        if os.path.islink(permit_path) or permit_path.is_dir():
            raise Refusal("permit path is a symlink or directory")
        return [], default_by
    entries = doc.get("grants") if isinstance(doc.get("grants"), list) else []
    kept = [e for e in entries if _valid_grant(e, now) is not None]
    by = doc.get("granted_by")
    return kept, (by if kept and isinstance(by, str) and by.strip() else default_by)


def _write_grant(root, grant, now, default_by):
    """Merge `grant` into the permit and audit it; the file only changes if the audit lands."""
    permit_path = Path(root) / PERMIT_REL
    kept, granted_by = _existing_grants(root, now, default_by)
    if len(kept) + 1 > MAX_GRANTS:
        raise Refusal("permit already holds %d grants" % MAX_GRANTS)
    tmp = permit_path.with_name(".privilege_permit.%d.tmp" % os.getpid())
    body = json.dumps({"granted_by": granted_by, "grants": kept + [grant]}, indent=2) + "\n"
    permit_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, "w") as handle:
        handle.write(body)
    scope = grant.get("path") or ",".join(grant.get("commands") or ["*"])
    if not audit_append(root, "granted", grant_id=grant["id"], kind=grant["kind"], scope=scope,
                        expires_at=grant["expires_at"], granted_by=granted_by):
        os.unlink(str(tmp))
        raise Refusal("audit log is not writable")
    os.replace(str(tmp), str(permit_path))


def _new_grant(request_id, kind, scope, ttl, reason, now):
    grant = {"id": request_id, "kind": kind, "created_at": iso(now),
             "expires_at": iso(now + timedelta(seconds=ttl)), "reason": clean(reason, 300)}
    if kind == "path":
        grant["path"] = scope
    else:
        verbs = validate_command_scope(scope)
        if verbs is not None:
            grant["commands"] = verbs
    return grant


@contextmanager
def _locked(root):
    directory = pending_dir(root)
    directory.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(directory / ".lock"), os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        os.close(fd)


def process_request(root, request_id, now, granted_by, decide):
    """Consume the pending request (single use), re-validate it, then grant or deny it.

    `decide(kind, scope, ttl, reason)` is the caller's last gate (the answer check for the hook,
    nothing for the operator's own `grant <id>`); it returns True to grant. Returns 'granted' or
    'denied'; raises Refusal for anything that must not proceed (the request is consumed once it
    was found, whatever the outcome).
    """
    with _locked(root):
        doc = load_pending(root, request_id)
        consume_pending(root, request_id)
        try:
            kind, scope, ttl, reason = validate_pending(doc, request_id, root, now)
            if not decide(kind, scope, ttl, reason):
                audit_append(root, "denied", grant_id=request_id, kind=kind, scope=scope)
                return "denied"
            _write_grant(root, _new_grant(request_id, kind, scope, ttl, reason, now), now,
                         granted_by)
        except Refusal as exc:
            audit_append(root, "denied", grant_id=request_id, why=str(exc))
            raise
    return "granted"


def _shape(value, depth=0):
    """Keys and types only: no question text, id or answer can survive into the skeleton."""
    if depth >= SHAPE_DEPTH:
        return "..."
    if isinstance(value, dict):
        return {(k if SHAPE_KEY_RE.fullmatch(k) else "<key>"): _shape(v, depth + 1)
                for k, v in list(value.items())[:20]}
    if isinstance(value, list):
        return [_shape(v, depth + 1) for v in value[:3]]
    return type(value).__name__


def write_payload_shape(root, payload):
    """Leave a text-free skeleton of an unrecognised answer for the live check; best effort."""
    skeleton = {"tool_input": _shape(payload.get("tool_input")),
                "tool_response": _shape(payload.get("tool_response"))}
    try:
        directory = pending_dir(root)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / SHAPE_FILE).write_text(json.dumps(skeleton, indent=2) + "\n")
    except OSError:
        pass


def _handle_answer(payload, root, now):
    questions = (payload.get("tool_input") or {}).get("questions")
    question = questions[0] if isinstance(questions, list) and questions else None
    if not isinstance(question, dict) or not isinstance(question.get("question"), str):
        return "ignored"
    tokens = ESC_TOKEN_RE.findall(question["question"])
    if not tokens:
        return "ignored"
    if not hook_ancestry_ok(payload.get("_chain") if sandbox_root(root) else None):
        return "refused:not called by a hook"
    answer = extract_answer(payload.get("tool_response"), question["question"])
    if answer is None:
        write_payload_shape(root, payload)
        return "refused:answer shape not recognised"

    def decide(kind, scope, ttl, reason):
        if len(set(tokens)) != 1:
            raise Refusal("question carries more than one escalation id")
        if question["question"] != question_text(tokens[0], kind, scope, reason, ttl):
            raise Refusal("question text differs from the request")
        if _option_labels(question) != ["Grant", "Deny"] or question.get("multiSelect"):
            raise Refusal("options are not exactly Grant and Deny")
        return answer == "Grant"

    try:
        return process_request(root, tokens[0], now, GRANTED_BY_ANSWER, decide)
    except Refusal as exc:
        return "refused:%s" % exc


def grant_from_answer(raw, root, chain=None, now=None):
    """Handle one PostToolUse payload. Returns granted | denied | ignored | refused:<why>."""
    try:
        payload = load_json_strict(raw)
        if not isinstance(payload, dict) or payload.get("tool_name") != "AskUserQuestion":
            return "ignored"
        payload = dict(payload, _chain=chain)
        return _handle_answer(payload, Path(root), utcnow(now))
    except Exception as exc:  # a crash would surface as a hook error on every AskUserQuestion
        return "refused:internal %s" % type(exc).__name__


def _write_tty(tty_fd, text):
    os.write(tty_fd, text.encode("utf-8", "replace"))


def _read_tty_line(tty_fd):
    """One typed line from the terminal fd, without the newline; '' on EOF."""
    data = b""
    while len(data) < MAX_TYPED:
        char = os.read(tty_fd, 1)
        if not char or char == b"\n":
            break
        data += char
    return data.decode("utf-8", "replace").strip()


def grant_fallback(request_id, root, chain=None, tty_fd=None, now=None):
    """The operator's `grant <id>`: granted | denied | refused:<why>; never raises.

    The terminal must be the controlling terminal of an ancestor CLI (cli_tty_ok), so a pty an agent
    built, a runpy trick inside its tool shell, or a plain terminal with no CLI is refused. The full
    request is shown there and the operator types the request id back; anything else leaves the
    request pending.
    """
    try:
        root = Path(root)
        if tty_fd is None:
            return "refused:grant needs an operator terminal (/dev/tty)"
        if (root / UNATTENDED_REL).exists():
            return "refused:the operator is away (UNATTENDED is set)"
        if not cli_tty_ok(tty_fd, chain if sandbox_root(root) else None):
            return "refused:this terminal is not the operator CLI's own"
        now = utcnow(now)
        kind, scope, ttl, reason = validate_pending(load_pending(root, request_id), request_id,
                                                    root, now)
        _write_tty(tty_fd, "\nEscalation %s: grant %s access?\n  Scope:    %s\n  Reason:   %s\n"
                           "  Duration: %s\nType the request id (%s) to grant, anything else "
                           "denies: " % (request_id, kind, scope, reason, format_ttl(ttl), request_id))
        if _read_tty_line(tty_fd) != request_id:
            return "refused:not confirmed on the terminal; the request is still pending"
        return process_request(root, request_id, now, GRANTED_BY_FALLBACK, lambda *_f: True)
    except Refusal as exc:
        return "refused:%s" % exc
    except Exception as exc:  # the fallback never raises into the operator's shell
        return "refused:internal %s" % type(exc).__name__


# ---------------------------------------------------------------------------------------------
# command line


def _flag(argv, name):
    at = argv.index(name) if name in argv else -1
    return argv[at + 1] if 0 <= at < len(argv) - 1 else ""


def _split_double_dash(argv):
    if "--" in argv:
        at = argv.index("--")
        return argv[:at], argv[at + 1:]
    return argv, []


def _emit(fields):
    sys.stdout.write("".join(f.replace("\0", " ") + "\0" for f in fields))


def _inner_fields(parsed):
    kind, payload = parsed
    inner = payload if kind in ("words", "edit") else ([payload] if kind == "shell" else [])
    return [kind] + list(inner)


def _cmd_use(argv):
    head, args = _split_double_dash(argv)
    root, verb = _flag(head, "--root"), _flag(head, "--verb")
    status, grant, granted_by, parsed = decide_use(root, verb, args, _flag(head, "--mode") or "run")
    if status != "ok":
        _emit([status])
        return 0
    _emit(["ok", grant["id"], clean(granted_by), grant["expires_at"]] + _inner_fields(parsed))
    return 0


def _cmd_parse(argv):
    head, args = _split_double_dash(argv)
    parsed = parse_elevation(_flag(head, "--verb"), args)
    _emit(["ok", "", "", ""] + _inner_fields(parsed) if parsed else ["deny:parse"])
    return 0


def _cmd_audit_used(argv):
    root, command = _flag(argv, "--root"), _flag(argv, "--command")
    for line in sys.stdin.read(MAX_STDIN_BYTES).splitlines():
        fields = line.split("\t")
        if len(fields) != 4:
            continue
        verb, grant_id, granted_by, expires = fields
        if not audit_append(root, "used", verb=verb, grant_id=grant_id, granted_by=granted_by,
                            expires_at=expires, command=command):
            return 1
    return 0


def _cmd_path_use(argv):
    head, targets = _split_double_dash(argv)
    root, command, tool = _flag(head, "--root"), _flag(head, "--command"), _flag(head, "--tool")
    grants = [covering_grant(root, t) for t in targets]
    if not targets or any(g is None for g in grants):
        return 1
    granted_by = load_permit(root)[0]
    for target, grant in zip(targets, grants):
        if not audit_append(root, "path_used", path=target, grant_id=grant["id"],
                            granted_by=granted_by, command=command, tool=tool):
            return 2
    return 0


COMMANDS = {"use": _cmd_use, "parse": _cmd_parse, "audit-used": _cmd_audit_used,
            "path-use": _cmd_path_use}


def main(argv):
    if len(argv) < 2 or argv[1] not in COMMANDS:
        sys.stderr.write("usage: privilege_permit.py {%s}\n" % "|".join(sorted(COMMANDS)))
        return 2
    try:
        return COMMANDS[argv[1]](argv[2:])
    except Exception as exc:  # fail closed: the caller reads a non-zero/empty answer as a deny
        sys.stderr.write("privilege_permit: %s\n" % type(exc).__name__)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
