#!/usr/bin/env python3
"""Speak one short sentence through the shared Voice service, one voice at a time.

Usage:
    voice_say.py [--hook] [--home DIR] [--project-dir DIR] [--voice NAME]
                 ( --text T | --event gate-green --mission SLUG | --event input-needed | --event prompt )

Policy lives here, the heavy part (model, venv) stays in the service folder, which defaults to
~/.athanor/voice. Nothing speaks until that folder holds a `.enabled` file, and nothing speaks
while the calling project has `.agent/memory/scratch/UNATTENDED`. Playback is a subprocess, so
a crashing backend cannot take the caller down. main() returns 0 on every path.

Env: VOICE_HOME, VOICE_BACKEND_CMD (spoken text appended as the last argument), VOICE_PLATFORM,
VOICE_MAX_WAIT_SECONDS, VOICE_PLAYBACK_TIMEOUT_SECONDS. Files in the folder: .enabled,
.speak.lock, .speak.log, and the registry voices.json (never created here; each project edits only its own entry, on the
operator's word).

Each project speaks in its own voice: voices.json maps a project directory name to a voice and a
spoken name, an unlisted project gets a stable sha256 pick from POOL, and the backend child gets
the choice as RANGER_VOICE. --voice NAME overrides that pick for one call when NAME is in POOL;
any other NAME speaks nothing and logs `voice rejected: NAME`.
A self-introduction the message already starts with is not
repeated.
"""
import hashlib
import json
import os
import re
import shlex
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows has no flock; voice is macOS-only and _play returns early there
    fcntl = None

_O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)

DEFAULT_HOME = "~/.athanor/voice"
DEFAULT_MAX_WAIT_SECONDS = 60
MAX_CHARS = 160
PLAYBACK_TIMEOUT_SECONDS = 120
GROUP_POLL_SECONDS = 0.05
VALUE_FLAGS = ("--home", "--project-dir", "--text", "--event", "--mission", "--voice")
TERM_GRACE_SECONDS = 0.1
TOKEN_ENV = "VOICE_PLAY_TOKEN"
KILL_ROUNDS = 3
EVENTS = ("gate-green", "input-needed", "prompt")
UNATTENDED_REL = Path(".agent") / "memory" / "scratch" / "UNATTENDED"
REGISTRY_NAME = "voices.json"
SLEEP_NAME = ".asleep"
VOICE_ON_REL = Path(".agent") / "memory" / "scratch" / "VOICE_ON"
SLEEP_MIN_SECONDS = 4 * 3600
MAX_PROMPT_BYTES = 1 << 16
GOODNIGHT = re.compile(
    r"\b(?:good\s?night|g'?night|night[- ]night|nighty[- ]night|"
    r"(?:going|heading|off)(?: off)? to (?:bed|sleep)|turning in for the night)\b", re.I)
VOICE_ON = re.compile(r"\bvoice\s+on\b", re.I)
VOICE_OFF = re.compile(r"\bvoice\s+off\b", re.I)
MAX_REGISTRY_BYTES = 1 << 20
SEPARATORS = ",:.;-"
FILLERS = frozenset(("here", "project", "agent", "session", "speaking", "is", "this"))
CLOSING_FILLERS = ("here", "speaking")
POOL = (
    "af_alloy", "af_aoede", "af_bella", "af_heart", "af_jessica", "af_kore", "af_nicole",
    "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir",
    "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa", "bf_alice", "bf_emma",
    "bf_isabella", "bf_lily", "bm_daniel", "bm_fable", "bm_george", "bm_lewis",
)


def _log(home, line):
    """Append one short line to the service log; a log that cannot be written is ignored."""
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        fd = os.open(str(home / ".speak.log"),
                     os.O_WRONLY | os.O_APPEND | os.O_CREAT | _O_NOFOLLOW, 0o644)
    except OSError:
        return
    try:
        os.write(fd, ("%s %s\n" % (stamp, line)).encode("utf-8", "replace"))
    except OSError:
        pass
    finally:
        os.close(fd)


class _Args:
    hook = False
    home = None
    project_dir = None
    text = None
    event = None
    mission = ""
    voice = None


def _parse(argv):
    """Parse by hand: the token after a value flag is always data, even when it starts with '-'
    (a mission slug of '-h' must still be announced). '--' ends the options; the rest is text.
    Returns None on an unknown flag, a missing value or a bad event."""
    args = _Args()
    tokens = list(argv)
    while tokens:
        token = tokens.pop(0)
        if token == "--":
            args.text = " ".join(tokens)
            break
        name, eq, value = token.partition("=")
        if name == "--hook" and not eq:
            args.hook = True
        elif name in VALUE_FLAGS:
            if not eq:
                if not tokens:
                    return None
                value = tokens.pop(0)
            setattr(args, name[2:].replace("-", "_"), value)
        else:
            return None
    if args.event is not None and args.event not in EVENTS:
        return None
    return args


def _message(args):
    if args.event == "gate-green":
        return "gate green, mission %s" % args.mission if args.mission else "gate green"
    if args.event == "input-needed":
        return "I need your input"
    return args.text or ""


def hash_voice(dir_name):
    """Stable pool voice for a project: sha256, not the per-process built-in, so every process agrees."""
    digest = hashlib.sha256(dir_name.lower().encode("utf-8", "surrogateescape")).hexdigest()
    return POOL[int(digest, 16) % len(POOL)]


def _text_field(entry, key):
    value = entry.get(key)
    return value.strip() if isinstance(value, str) and value.strip() else None


def load_entry(home, dir_name):
    """Return (voice, name) from <home>/voices.json for this directory name, each None when the
    registry or the field is missing or malformed. The file is only ever read."""
    try:
        with open(home / REGISTRY_NAME, "rb") as handle:
            raw = handle.read(MAX_REGISTRY_BYTES + 1)
        if len(raw) > MAX_REGISTRY_BYTES:
            return None, None
        projects = json.loads(raw.decode("utf-8")).get("projects")
    except (OSError, ValueError, RecursionError, AttributeError):
        return None, None
    if not isinstance(projects, dict):
        return None, None
    wanted = dir_name.lower()
    for key, entry in projects.items():
        if isinstance(entry, dict) and key.lower() == wanted:
            return _text_field(entry, "voice"), _text_field(entry, "name")
    return None, None


def _unit_end(text, start, names):
    """Index just past one introduction unit starting at start, or -1 when none starts there.
    A unit is NAME [FILLER ...] END, END being a separator run followed by whitespace or the end,
    the end of the text, or no separator after the filler here or speaking."""
    size = len(text)
    for name in names:
        stop = start + len(name)
        if text[start:stop].lower() != name.lower():
            continue
        if stop < size and not text[stop].isspace() and text[stop] not in SEPARATORS:
            continue
        end = _scan_unit(text, stop)
        if end >= 0:
            return end
    return -1


def _scan_unit(text, pos):
    size = len(text)
    last = None
    while True:
        while pos < size and text[pos].isspace():
            pos += 1
        if pos >= size:
            return size
        if text[pos] in SEPARATORS:
            stop = pos
            while stop < size and text[stop] in SEPARATORS:
                stop += 1
            return stop if stop >= size or text[stop].isspace() else -1
        stop = pos
        while stop < size and not text[stop].isspace() and text[stop] not in SEPARATORS:
            stop += 1
        word = text[pos:stop].lower()
        if word in FILLERS:
            last, pos = word, stop
            continue
        return pos if last in CLOSING_FILLERS else -1


def strip_introduction(message, names):
    """Drop self-introduction units from the start of an already whitespace-collapsed message."""
    ordered = sorted({" ".join(n.split()) for n in names if n and n.strip()}, key=len, reverse=True)
    pos = 0
    while True:
        while pos < len(message) and message[pos].isspace():
            pos += 1
        end = _unit_end(message, pos, ordered)
        if end < 0:
            return message[pos:]
        pos = end


def _names_self_early(message, names):
    """True when a name or alias appears in the message as a whole word, possessive allowed."""
    alts = sorted({" ".join(n.split()) for n in names if n and n.strip()}, key=len, reverse=True)
    if not alts:
        return False
    pattern = r"(?<!\w)(?:" + "|".join(re.escape(a) for a in alts) + r")(?:['\u2019]s)?(?!\w)"
    return re.search(pattern, message, re.IGNORECASE) is not None


def compose(name, aliases, message):
    """Return '<name>: <message>' as one line of at most MAX_CHARS, cut at a word boundary, with
    any introduction the message already starts with removed. Empty when nothing is left."""
    message = strip_introduction(" ".join(message.split()), [name] + list(aliases))
    if not message:
        return ""
    prefix = "" if _names_self_early(message, [name] + list(aliases)) else name + ": "
    text = prefix + message
    if len(text) <= MAX_CHARS:
        return text
    if text[MAX_CHARS] == " ":
        return text[:MAX_CHARS]
    cut = text[:MAX_CHARS].rfind(" ")
    return text[:cut] if cut > len(prefix) else text[:MAX_CHARS]


def _backend(home, text):
    override = os.environ.get("VOICE_BACKEND_CMD")
    if override:
        return shlex.split(override) + [text]
    python = home / ".venv-voice" / "bin" / "python"
    script = home / "tools" / "speak.py"
    if not (python.exists() and script.exists()):
        return None
    return [str(python), str(script), text]


def _silenced(home, project_dir):
    if not (home / ".enabled").exists() or (project_dir / UNATTENDED_REL).exists():
        return True
    return (home / SLEEP_NAME).exists() and not (project_dir / VOICE_ON_REL).exists()


def _sleep_limit():
    try:
        value = float(os.environ.get("VOICE_SLEEP_MIN_SECONDS", SLEEP_MIN_SECONDS))
    except ValueError:
        return float(SLEEP_MIN_SECONDS)
    return value if value >= 0 else float(SLEEP_MIN_SECONDS)


def _set_voice_on(project_dir, on):
    """Create or remove the project's own VOICE_ON flag; "voice off" without the flag is a no-op."""
    flag = project_dir / VOICE_ON_REL
    if not on:
        if flag.is_symlink() or flag.exists():
            flag.unlink()
        return
    flag.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(flag), os.O_WRONLY | os.O_CREAT | _O_NOFOLLOW, 0o644)
    os.close(fd)


def _on_prompt(home, project_dir):
    """UserPromptSubmit hook: a goodnight in any project silences the whole fleet by writing
    <home>/.asleep; the first prompt in any project at least VOICE_SLEEP_MIN_SECONDS (4 h)
    later clears it, which is the operator's morning greeting. "voice on" / "voice off" toggles
    the calling project's own <project>/.agent/memory/scratch/VOICE_ON, which speaks even while
    the fleet sleeps; a goodnight removes it."""
    flag = home / SLEEP_NAME
    try:
        if flag.exists() and time.time() - flag.stat().st_mtime >= _sleep_limit():
            flag.unlink()
        raw = sys.stdin.read(MAX_PROMPT_BYTES)
        prompt = json.loads(raw).get("prompt") if raw.strip() else None
        if isinstance(prompt, str) and GOODNIGHT.search(prompt):
            _set_voice_on(project_dir, False)
            fd = os.open(str(flag), os.O_WRONLY | os.O_CREAT | os.O_TRUNC | _O_NOFOLLOW, 0o644)
            os.close(fd)
            os.utime(str(flag))
        elif isinstance(prompt, str) and VOICE_OFF.search(prompt):
            _set_voice_on(project_dir, False)
        elif isinstance(prompt, str) and VOICE_ON.search(prompt):
            _set_voice_on(project_dir, True)
    except (OSError, ValueError, RecursionError, AttributeError):
        pass


def _playback_limit():
    """Seconds a backend may run; a non-numeric or non-positive value falls back to the default."""
    try:
        value = float(os.environ.get("VOICE_PLAYBACK_TIMEOUT_SECONDS", PLAYBACK_TIMEOUT_SECONDS))
    except ValueError:
        return float(PLAYBACK_TIMEOUT_SECONDS)
    return value if value > 0 else float(PLAYBACK_TIMEOUT_SECONDS)


def _wait_limit():
    try:
        return float(os.environ.get("VOICE_MAX_WAIT_SECONDS", DEFAULT_MAX_WAIT_SECONDS))
    except ValueError:
        return float(DEFAULT_MAX_WAIT_SECONDS)


def _group_alive(pgid):
    try:
        os.killpg(pgid, 0)
    except (ProcessLookupError, PermissionError):
        return False
    return True


def _kill_group(pgid):
    try:
        os.killpg(pgid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def _ps(args):
    """Text of one ps run, or None when ps cannot be run or read; undecodable bytes are replaced."""
    try:
        return subprocess.run(["ps"] + args, capture_output=True, text=True, errors="replace",
                              timeout=5).stdout
    except (OSError, subprocess.SubprocessError, ValueError):
        return None


def _descendants(root):
    """Every live descendant pid of root, found by walking ps parent links until no new pid
    appears. A grandchild that called setsid keeps its parent link, so the walk still finds it."""
    out = _ps(["-axo", "pid=,ppid="])
    if out is None:
        return None
    children = {}
    for line in out.splitlines():
        fields = line.split()
        if len(fields) == 2 and fields[0].isdigit() and fields[1].isdigit():
            children.setdefault(int(fields[1]), []).append(int(fields[0]))
    found, frontier = [], [root]
    while frontier:
        fresh = [c for p in frontier for c in children.get(p, ()) if c not in found]
        found.extend(fresh)
        frontier = fresh
    return found


def _signal_all(pids, sig):
    for pid in pids:
        try:
            os.kill(pid, sig)
        except (ProcessLookupError, PermissionError):
            pass


def _tagged(token):
    """Pids of every process whose environment carries token, reparented or in a new session.
    The token is unique per playback, so a recycled pid can never match."""
    out = _ps(["-wwE", "-ax", "-o", "pid=,command="])
    if out is None:
        return None
    marker = "%s=%s" % (TOKEN_ENV, token)
    found = []
    for line in out.splitlines():
        fields = line.split(None, 1)
        if len(fields) == 2 and fields[0].isdigit() and marker in fields[1].split():
            found.append(int(fields[0]))
    return [pid for pid in found if pid != os.getpid()]


def _kill_tree(root, token):
    """SIGTERM then SIGKILL every descendant of root and every process still carrying the
    playback token, escaped sessions and orphans included; repeat until none is left.
    Returns False when ps could not be read, so the caller can log the limit."""
    for _ in range(KILL_ROUNDS):
        walked, tagged = _descendants(root), _tagged(token)
        if walked is None or tagged is None:
            return False
        pids = sorted(set(walked) | set(tagged))
        if not pids:
            return True
        _signal_all(pids, signal.SIGTERM)
        time.sleep(TERM_GRACE_SECONDS)
        _signal_all(pids, signal.SIGKILL)
    return True


def _play_group(cmd, env, note=None):
    """Run the backend in its own process group and return only when the whole group is gone, so
    the lock outlives the audio. A backend past the deadline is killed with its children and
    None is returned."""
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, start_new_session=True, env=env)
    limit = _playback_limit()
    deadline = time.monotonic() + limit
    try:
        code = proc.wait(timeout=limit)
        while _group_alive(proc.pid):
            if time.monotonic() >= deadline:
                return None
            time.sleep(GROUP_POLL_SECONDS)
        return code
    except subprocess.TimeoutExpired:
        return None
    finally:
        try:
            if not _kill_tree(proc.pid, env[TOKEN_ENV]) and note:
                note("cleanup: ps unavailable")
        finally:
            _kill_group(proc.pid)
            proc.wait()


def _play(home, project_dir, text, voice, started):
    """Wait for the turn, then play. Everything here fails soft."""
    if fcntl is None:
        return
    try:
        fd = os.open(str(home / ".speak.lock"), os.O_RDWR | os.O_CREAT, 0o600)
    except OSError:
        return
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        waited = time.monotonic() - started
        if waited > _wait_limit():
            _log(home, "dropped (waited %.0fs): %s" % (waited, text))
            return
        if _silenced(home, project_dir):
            return
        cmd = _backend(home, text)
        if cmd is None:
            return
        try:
            env = dict(os.environ, RANGER_VOICE=voice, **{TOKEN_ENV: uuid.uuid4().hex})
            code = _play_group(cmd, env, lambda line: _log(home, line))
            if code is None:
                _log(home, "backend timeout, killed: %s" % text)
            else:
                _log(home, "spoke rc=%d: %s" % (code, text))
        except (OSError, subprocess.SubprocessError) as exc:
            _log(home, "backend failed (%s): %s" % (type(exc).__name__, text))
    finally:
        os.close(fd)


def _run(argv):
    started = time.monotonic()
    args = _parse(argv)
    if args is None:
        return
    project_dir = Path(args.project_dir or os.getcwd())
    home = Path(os.path.expanduser(args.home or os.environ.get("VOICE_HOME") or DEFAULT_HOME))
    reason = None
    if os.environ.get("VOICE_PLATFORM", sys.platform) != "darwin":
        reason = "voice output is macOS only"
    elif not home.is_dir():
        reason = "voice service folder not found: %s" % home
    if reason:
        if not args.hook:
            print("voice_say: %s" % reason, file=sys.stderr)
        return
    if args.event == "prompt":
        _on_prompt(home, project_dir)
        return
    if args.voice is not None and args.voice not in POOL:
        _log(home, "voice rejected: %s" % args.voice)
        return
    dir_name = os.path.basename(os.path.abspath(project_dir))
    voice, name = load_entry(home, dir_name)
    spoken = name or dir_name
    text = compose(spoken, [dir_name], _message(args))
    if not text or _silenced(home, project_dir):
        return
    _play(home, project_dir, text, args.voice or voice or hash_voice(dir_name), started)


def main(argv=None):
    try:
        _run(sys.argv[1:] if argv is None else argv)
    except Exception:  # a speaker must never fail its caller
        pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
