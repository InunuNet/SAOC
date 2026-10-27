#!/usr/bin/env python3
"""Resume a checkpointed mission after a Claude Code quota reset, exactly once.

An opted-in project gets one per-project launchd unit (macOS) that runs
``tick`` every TICK_INTERVAL_SECONDS. ``execution/statusline.py`` records each
exhaustion in ``.agent/memory/scratch/quota_resume/exhausted.json``; the tick
starts one fresh headless ``claude -p`` session once that window has reset, and
only when every gate below passes.

    install     write the plist, load it, record the opt-in
    uninstall   unload it, delete the plist, record the opt-out
    status      what is installed, pending and last resumed (--json for tools)
    tick        one idempotent pass; always exits 0

Safety, in the order it matters:
  * the event is spent in the ledger BEFORE the spawn: a crash mid-run loses
    one resume and never repeats one;
  * the child never inherits an API key, auth token or provider switch: this
    spends the subscription or nothing;
  * one run at a time, behind an O_EXCL lock with a pid-liveness check;
  * a run is killed at MAX_RUN_SECONDS;
  * ATHANOR_LAUNCHCTL / ATHANOR_LAUNCH_AGENTS_DIR / ATHANOR_CLAUDE_BIN let a
    test drive every path without the real launchd domain or a paid session.

Design: .agent/memory/project/specs/quota-auto-resume/DECISIONS.md
"""
from __future__ import annotations

import argparse
try:
    import fcntl
except ImportError:  # Windows: no flock; the locked paths below degrade to no-ops
    fcntl = None
import hashlib
import json
import logging
import os
import plistlib
import re
import shutil
import signal
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

TICK_INTERVAL_SECONDS = 600
RESET_GRACE_SECONDS = 120
QUIET_SECONDS = 600
MAX_RUN_SECONDS = 18000
FALLBACK_WAIT_SECONDS = 18000
FUTURE_SKEW_SECONDS = 300
MAX_EVENT_AGE_SECONDS = 691200
LEDGER_MAX = 50
KILL_GRACE_SECONDS = 10
UNINSTALL_WAIT_SECONDS = 10
UNINSTALL_POLL_SECONDS = 0.1
NOTIFY_TIMEOUT_SECONDS = 10
BANNER_MAX_RUNS = 5
MS_EPOCH_THRESHOLD = 10 ** 12

EXIT_USAGE = 2
ISO_UTC_FORMAT = "%Y-%m-%dT%H:%M:%SZ"
LABEL_PREFIX = "com.athanor.quota-resume"
CONFIG_SCHEMA = "athanor.quota-auto-resume/v1"
SAFE_PATH = ("/usr/bin", "/bin", "/usr/sbin", "/sbin")
STRIPPED_ENV = ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_USE_BEDROCK",
                "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY")
WINDOWS = ("five_hour", "seven_day")

ENV_AGENTS_DIR = "ATHANOR_LAUNCH_AGENTS_DIR"
ENV_LAUNCHCTL = "ATHANOR_LAUNCHCTL"
ENV_CLAUDE_BIN = "ATHANOR_CLAUDE_BIN"
ENV_MAX_RUN = "ATHANOR_QUOTA_RESUME_MAX_RUN_SECONDS"
ENV_NOTIFY = "ATHANOR_QUOTA_RESUME_NOTIFY"

CONFIG_REL = Path(".agent/memory/project/quota_auto_resume.json")
ACTIVE_REL = Path(".agent/memory/project/missions/active.json")
TELEMETRY_REL = Path(".agent/memory/project/telemetry/quota_resume.jsonl")
QR_REL = Path(".agent/memory/scratch/quota_resume")
UNATTENDED_REL = Path(".agent/memory/scratch/UNATTENDED")
BANNER_REL = Path(".agent/memory/scratch/.quota_death_checkpoint.json")

log = logging.getLogger("quota_auto_resume")


# ── Small helpers ─────────────────────────────────────────────────────────────

def now_epoch() -> float:
    return datetime.now(timezone.utc).timestamp()


def iso(epoch: float) -> str:
    return datetime.fromtimestamp(int(epoch), timezone.utc).strftime(ISO_UTC_FORMAT)


def parse_iso(value) -> float | None:
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def read_json(path: Path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return None


def write_json_atomic(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.{uuid.uuid4().hex[:8]}.tmp")
    tmp.write_text(json.dumps(data, indent=2))
    tmp.replace(path)


def pid_alive(pid) -> bool:
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def label_for(root: Path) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", root.name.lower()).strip("-") or "project"
    digest = hashlib.sha256(str(root).encode()).hexdigest()[:8]
    return f"{LABEL_PREFIX}.{slug}.{digest}"


def agents_dir() -> Path:
    told = os.environ.get(ENV_AGENTS_DIR)
    return Path(told).expanduser() if told else Path.home() / "Library" / "LaunchAgents"


def launchctl_bin() -> str:
    return os.environ.get(ENV_LAUNCHCTL) or "launchctl"


def launchctl(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([launchctl_bin(), *args], capture_output=True, text=True)


def executable(path) -> bool:
    return bool(path) and os.path.isfile(path) and os.access(path, os.X_OK)


def resolve_claude(config: dict | None) -> str | None:
    """ATHANOR_CLAUDE_BIN, then the recorded path, then the current PATH. Nothing else."""
    told = os.environ.get(ENV_CLAUDE_BIN)
    if executable(told):
        return told
    recorded = (config or {}).get("claude_bin")
    if executable(recorded):
        return recorded
    found = shutil.which("claude")
    return os.path.abspath(found) if found else None


# ── Per-project state ─────────────────────────────────────────────────────────

class Project:
    def __init__(self, root: Path):
        self.root = root
        self.qr = root / QR_REL
        self.label = label_for(root)

    @property
    def config(self) -> dict | None:
        data = read_json(self.root / CONFIG_REL)
        return data if isinstance(data, dict) else None

    def plist_path(self, config: dict | None = None) -> Path:
        recorded = (config or {}).get("plist_path")
        return Path(recorded) if recorded else agents_dir() / f"{self.label}.plist"

    def opted_in(self, config: dict | None) -> bool:
        return bool(config and config.get("enabled") is True
                    and config.get("project_root") == str(self.root))

    def record(self) -> dict | None:
        """The exhaustion record, only when it is complete and parseable."""
        data = read_json(self.qr / "exhausted.json")
        if not isinstance(data, dict) or not data.get("event_id"):
            return None
        if parse_iso(data.get("resets_at")) is None:
            return None
        return data

    def ledger(self) -> list[dict]:
        data = read_json(self.qr / "consumed.json")
        entries = data.get("entries") if isinstance(data, dict) else None
        return entries if isinstance(entries, list) else []

    def spent(self, event_id: str) -> bool:
        return any(e.get("event_id") == event_id for e in self.ledger()
                   if isinstance(e, dict))

    def spend(self, event_id: str, outcome: str) -> None:
        entries = self.ledger() + [{"event_id": event_id, "outcome": outcome,
                                    "at": iso(now_epoch())}]
        write_json_atomic(self.qr / "consumed.json", {"entries": entries[-LEDGER_MAX:]})

    def events(self) -> list[dict]:
        try:
            lines = (self.root / TELEMETRY_REL).read_text().splitlines()
        except OSError:
            return []
        out = []
        for line in lines:
            try:
                item = json.loads(line)
            except ValueError:
                continue
            if isinstance(item, dict):
                out.append(item)
        return out

    def log_event(self, event: str, event_id: str | None = None, **fields) -> None:
        path = self.root / TELEMETRY_REL
        path.parent.mkdir(parents=True, exist_ok=True)
        line = {"ts": iso(now_epoch()), "event": event, "event_id": event_id,
                "project_root": str(self.root), **fields}
        with open(path, "a") as handle:
            handle.write(json.dumps(line) + "\n")

    def log_error_once(self, event_id: str | None, reason: str) -> None:
        seen = any(e.get("event") == "error" and e.get("event_id") == event_id
                   and e.get("reason") == reason for e in self.events())
        if not seen:
            self.log_event("error", event_id, reason=reason)

    def active_mission(self) -> Path | None:
        active = read_json(self.root / ACTIVE_REL)
        rel = active.get("mission") if isinstance(active, dict) else None
        if not rel:
            return None
        path = self.root / str(rel)
        return path if path.is_file() else None

    def last_activity(self) -> float | None:
        """Latest operator signal: the heartbeat, or any seen session's transcript mtime.

        A transcript is appended the moment a prompt is submitted, before any
        statusline fingerprint field moves, so its mtime is the earlier signal.
        """
        beat = read_json(self.qr / "heartbeat.json")
        if not isinstance(beat, dict):
            return None
        seen = [parse_iso(beat.get("activity_at"))]
        sessions = beat.get("sessions")
        for entry in (sessions.values() if isinstance(sessions, dict) else ()):
            path = entry.get("transcript_path") if isinstance(entry, dict) else None
            try:
                seen.append(os.stat(path).st_mtime if path else None)
            except OSError:
                continue
        times = [x for x in seen if x is not None]
        return max(times) if times else None


def mission_slug(mission_file: Path) -> str:
    try:
        text = mission_file.read_text()
    except OSError:
        return mission_file.stem
    found = re.search(r"^slug:\s*(\S+)\s*$", text, re.M)
    return found.group(1).strip("'\"") if found else mission_file.stem


# ── install / uninstall / status ──────────────────────────────────────────────

def build_plist(project: Project, claude_bin: str) -> dict:
    path_dirs = []
    for entry in (os.path.dirname(claude_bin), os.path.dirname(sys.executable), *SAFE_PATH):
        if entry and entry not in path_dirs:
            path_dirs.append(entry)
    return {
        "Label": project.label,
        "ProgramArguments": [sys.executable,
                             str(project.root / "execution" / "quota_auto_resume.py"),
                             "tick", "--project", str(project.root)],
        "WorkingDirectory": str(project.root),
        "StartInterval": TICK_INTERVAL_SECONDS,
        "RunAtLoad": True,
        "EnvironmentVariables": {"PATH": ":".join(path_dirs)},
        "StandardOutPath": str(project.qr / "launchd.log"),
        "StandardErrorPath": str(project.qr / "launchd.log"),
    }


def cmd_install(project: Project) -> int:
    if sys.platform != "darwin":
        print("quota_auto_resume: install needs macOS (launchd)", file=sys.stderr)
        return EXIT_USAGE
    claude_bin = resolve_claude(project.config)
    if not claude_bin:
        print("quota_auto_resume: claude not found (ATHANOR_CLAUDE_BIN or PATH); "
              "nothing installed", file=sys.stderr)
        return EXIT_USAGE
    plist = project.plist_path()
    plist.parent.mkdir(parents=True, exist_ok=True)
    project.qr.mkdir(parents=True, exist_ok=True)
    plist.write_bytes(plistlib.dumps(build_plist(project, claude_bin)))
    domain = f"gui/{os.getuid()}"
    try:
        launchctl("bootout", f"{domain}/{project.label}")
        loaded = launchctl("bootstrap", domain, str(plist))
    except OSError as exc:
        print(f"quota_auto_resume: launchctl failed: {exc}", file=sys.stderr)
        return 1
    if loaded.returncode != 0:
        print(f"quota_auto_resume: launchctl bootstrap rc={loaded.returncode}: "
              f"{loaded.stderr.strip()}", file=sys.stderr)
        return 1
    write_json_atomic(project.root / CONFIG_REL, {
        "schema": CONFIG_SCHEMA, "enabled": True, "project_root": str(project.root),
        "label": project.label, "plist_path": str(plist), "claude_bin": claude_bin,
        "python_bin": sys.executable, "installed_at": iso(now_epoch())})
    print(f"installed {project.label}")
    return 0


def disable(project: Project) -> None:
    config = project.config
    try:
        launchctl("bootout", f"gui/{os.getuid()}/{project.label}")
    except OSError as exc:
        log.warning("launchctl bootout failed: %s", exc)
    project.plist_path(config).unlink(missing_ok=True)
    if config is not None:
        write_json_atomic(project.root / CONFIG_REL, {**config, "enabled": False})


def lock_record(project: Project) -> dict:
    data = read_json(project.qr / "run.lock")
    return data if isinstance(data, dict) else {}


def cmd_uninstall(project: Project) -> int:
    """Opt out, serialised with a tick's check-then-spawn window; never kills a run."""
    deadline = now_epoch() + UNINSTALL_WAIT_SECONDS
    while True:
        fd = acquire_flock(project)
        if fd is not None:
            try:
                disable(project)
            finally:
                release_lock(project, fd)
            break
        child = lock_record(project).get("child_pid")
        if child:
            disable(project)
            print(f"a resume run started before uninstall is still running (pid {child}); "
                  f"it finishes on its own, or stop it with: kill -TERM -{child}")
            break
        if now_epoch() >= deadline:
            disable(project)
            print("uninstall: a tick held the lock for "
                  f"{UNINSTALL_WAIT_SECONDS}s; opted out anyway, a run may have started")
            break
        time.sleep(UNINSTALL_POLL_SECONDS)
    print(f"uninstalled {project.label}")
    return 0


def last_resume(project: Project) -> dict | None:
    events = project.events()
    finished = [e for e in events if e.get("event") == "resume_finished"]
    if not finished:
        return None
    last = finished[-1]
    started = next((e for e in events if e.get("event") == "resume_started"
                    and e.get("session_id") == last.get("session_id")), {})
    return {"session_id": last.get("session_id"), "event_id": last.get("event_id"),
            "started_at": started.get("ts"), "finished_at": last.get("ts"),
            "exit_code": last.get("exit_code"), "timed_out": last.get("timed_out")}


def status_of(project: Project) -> dict:
    config = project.config
    claude_bin = resolve_claude(config)
    record = project.record()
    pending = record if record and not project.spent(record["event_id"]) else None
    resets = parse_iso(pending["resets_at"]) if pending else None
    return {
        "opted_in": project.opted_in(config),
        "label": project.label,
        "plist_path": str(project.plist_path(config)),
        "plist_present": project.plist_path(config).is_file(),
        "claude_bin": claude_bin,
        "claude_ok": claude_bin is not None,
        "pending_event": pending,
        "next_resume_at": iso(resets + RESET_GRACE_SECONDS) if resets is not None else None,
        "last_resume": last_resume(project),
        "check_interval_seconds": TICK_INTERVAL_SECONDS,
    }


def cmd_status(project: Project, as_json: bool) -> int:
    info = status_of(project)
    if as_json:
        print(json.dumps(info, indent=2))
    else:
        for key, value in info.items():
            print(f"{key}: {json.dumps(value) if isinstance(value, (dict, list)) else value}")
    return 0


# ── tick ──────────────────────────────────────────────────────────────────────

def notify(message: str) -> None:
    """Best-effort macOS notification; never raises."""
    if os.environ.get(ENV_NOTIFY) == "0" or not shutil.which("osascript"):
        return
    script = ["-e", "on run argv", "-e",
              'display notification (item 1 of argv) with title "Athanor quota resume"',
              "-e", "end run"]
    try:
        subprocess.run(["osascript", *script, message], capture_output=True,
                       timeout=NOTIFY_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return


def acquire_flock(project: Project) -> int | None:
    """flock(LOCK_EX|LOCK_NB) run.lock, or None when another process holds it."""
    if fcntl is None:
        return None  # no flock, no safe single-run guarantee: never run
    project.qr.mkdir(parents=True, exist_ok=True)
    path = project.qr / "run.lock"
    for _ in range(2):
        fd = os.open(path, os.O_CREAT | os.O_RDWR)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            os.close(fd)
            return None
        try:
            same = os.fstat(fd).st_ino == os.stat(path).st_ino
        except OSError:
            same = False
        if same:
            return fd
        os.close(fd)  # the previous holder unlinked it between our open and flock
    return None


def take_lock(project: Project) -> int | None:
    """acquire_flock, held for the whole run, with this tick's pid written in.

    The kernel drops the lock when the holder dies, so there is no stale-lock
    cleanup. The pid in the file is information only, with one read-only
    exception: a live foreign pid written within one run's maximum span means
    another writer holds the run, so this tick stands down. Nothing is ever
    renamed or deleted on suspicion.
    """
    fd = acquire_flock(project)
    if fd is None:
        return None
    if foreign_run_recorded(fd):
        os.close(fd)
        return None
    os.ftruncate(fd, 0)
    os.write(fd, json.dumps({"pid": os.getpid(), "started_at": iso(now_epoch())}).encode())
    return fd


def foreign_run_recorded(fd: int) -> bool:
    try:
        data = json.loads(os.pread(fd, 4096, 0) or b"{}")
    except ValueError:
        return False
    pid, started = data.get("pid"), parse_iso(data.get("started_at"))
    return (pid_alive(pid) and pid != os.getpid() and started is not None
            and now_epoch() - started < MAX_RUN_SECONDS + KILL_GRACE_SECONDS)


def release_lock(project: Project, fd: int) -> None:
    """Unlink while still holding it; acquirers re-check the inode after flock."""
    (project.qr / "run.lock").unlink(missing_ok=True)
    os.close(fd)


def gate(project: Project, record: dict, now: float) -> tuple[str, str | None]:
    """('go'|'wait'|'spend'|'error', detail) for an unspent, parseable record."""
    resets = parse_iso(record["resets_at"])
    recorded = parse_iso(record.get("recorded_at"))
    if recorded is not None and recorded > now + FUTURE_SKEW_SECONDS:
        return "error", "recorded_at_in_future"
    if now < resets + RESET_GRACE_SECONDS:
        return "wait", None
    if now > resets + MAX_EVENT_AGE_SECONDS:
        return "spend", "expired"
    activity = project.last_activity()
    if activity is not None and activity > resets:
        return "spend", "superseded"
    if activity is not None and activity > now - QUIET_SECONDS:
        return "wait", None
    if project.active_mission() is None:
        return "spend", "no_mission"
    return "go", None


def build_prompt(slug: str, record: dict) -> str:
    return (
        f"This is an unattended run started by execution/quota_auto_resume.py after the "
        f"{record['window']} quota reset at {record['resets_at']}, not by the operator. "
        f"Run `python3 execution/mission.py resume` and continue the active mission "
        f"`{slug}` from its checkpoint. Do not start a new mission, do not claim operator "
        f"approval, and take no action that needs it. If you are blocked, record the "
        f"blocker in the mission and stop. Commit and push follow the project's own rules.")


def child_env() -> dict:
    return {k: v for k, v in os.environ.items() if k not in STRIPPED_ENV}


def max_run_seconds() -> int:
    try:
        return max(1, int(os.environ.get(ENV_MAX_RUN, MAX_RUN_SECONDS)))
    except ValueError:
        return MAX_RUN_SECONDS


def record_child_pid(project: Project, pid: int) -> None:
    """Mark run.lock (still held by this tick) so uninstall can tell a run began."""
    path = project.qr / "run.lock"
    write_lock_json = {**lock_record(project), "child_pid": pid}
    with open(path, "r+") as handle:
        handle.truncate(0)
        handle.write(json.dumps(write_lock_json))


def run_child(project: Project, argv: list[str], log_path: Path) -> tuple[int, bool]:
    """Run the child in its own process group, killing the group at the cap."""
    timed_out = False
    with open(log_path, "wb") as sink:
        proc = subprocess.Popen(argv, cwd=project.root, env=child_env(), stdout=sink,
                                stderr=subprocess.STDOUT, start_new_session=True)
        record_child_pid(project, proc.pid)
        try:
            code = proc.wait(timeout=max_run_seconds())
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.wait(timeout=KILL_GRACE_SECONDS)
            except subprocess.TimeoutExpired:
                pass
            # The parent may exit on SIGTERM while its children linger: the
            # group is killed regardless, so nothing outlives the cap.
            try:
                os.killpg(proc.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            code = proc.wait()
    return code, timed_out


def rejected_reset(log_path: Path, now: float) -> tuple[str, float] | None:
    """The latest (window, resets_at) among `rejected` rate_limit_events in the stream."""
    best = None
    try:
        lines = log_path.read_text(errors="replace").splitlines()
    except OSError:
        return None
    for line in lines:
        try:
            item = json.loads(line)
        except ValueError:
            continue
        info = item.get("rate_limit_info") if isinstance(item, dict) else None
        if (not isinstance(item, dict) or item.get("type") != "rate_limit_event"
                or not isinstance(info, dict) or info.get("status") != "rejected"):
            continue
        resets = info.get("resetsAt")
        if isinstance(resets, bool) or not isinstance(resets, (int, float)):
            resets = now + FALLBACK_WAIT_SECONDS
        elif resets > MS_EPOCH_THRESHOLD:
            resets = resets / 1000
        window = "seven_day" if "seven" in str(info.get("rateLimitType", "")) else "five_hour"
        if best is None or resets > best[1]:
            best = (window, float(resets))
    return best


def record_reexhaustion(project: Project, found: tuple[str, float]) -> None:
    window, resets = found
    resets_iso = iso(resets)
    write_json_atomic(project.qr / "exhausted.json", {
        "schema": "athanor.quota-exhaustion/v1", "event_id": f"{window}@{resets_iso}",
        "window": window, "resets_at": resets_iso, "used_pct": 100.0,
        "recorded_at": iso(now_epoch()), "source": "resume_stream"})


def write_banner(project: Project) -> None:
    activity = project.last_activity()
    runs = [e for e in project.events() if e.get("event") == "resume_finished"
            and (activity is None or (parse_iso(e.get("ts")) or 0) > activity)]
    lines = ["QUOTA AUTO-RESUME: unattended session(s) ran after a quota reset:"]
    for run in runs[-BANNER_MAX_RUNS:]:
        lines.append(f"  session {run.get('session_id')} exit={run.get('exit_code')} "
                     f"log={run.get('run_log')} -- continue: claude -r {run.get('session_id')}")
    write_json_atomic(project.root / BANNER_REL, {
        "timestamp": iso(now_epoch()), "stop_reason": "quota_auto_resume",
        "recovery_message": "\n".join(lines)})


def resume(project: Project, record: dict, claude_bin: str) -> None:
    """Spend the event, then run one bounded headless session. Caller holds the lock."""
    event_id = record["event_id"]
    project.spend(event_id, "started")
    mission = project.active_mission()
    session_id = str(uuid.uuid4())
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    log_path = project.qr / f"run-{stamp}.log"
    argv = [claude_bin, "-p", build_prompt(mission_slug(mission), record),
            "--output-format", "stream-json", "--verbose", "--session-id", session_id,
            "-n", f"quota-auto-resume {event_id}", "--permission-prompts", "none"]
    unattended = project.root / UNATTENDED_REL
    created = not unattended.exists()
    if created:
        unattended.parent.mkdir(parents=True, exist_ok=True)
        unattended.touch()
    ident = {"session_id": session_id, "window": record["window"],
             "resets_at": record["resets_at"]}
    project.log_event("resume_started", event_id, **ident)
    started = now_epoch()
    code, timed_out = -1, False
    try:
        code, timed_out = run_child(project, argv, log_path)
    except OSError as exc:
        project.log_event("error", event_id, reason=f"spawn_failed:{type(exc).__name__}")
    finally:
        if created:
            unattended.unlink(missing_ok=True)
    project.log_event("resume_finished", event_id, **ident, exit_code=code,
                      timed_out=timed_out, duration_s=int(now_epoch() - started),
                      run_log=str(log_path))
    again = rejected_reset(log_path, now_epoch())
    if again:
        record_reexhaustion(project, again)
    write_banner(project)
    notify(f"Resumed mission after {record['window']} reset (exit {code}). "
           f"Continue with: claude -r {session_id}")


def tick_locked(project: Project) -> None:
    """Re-evaluate opt-in and every gate under the lock: earlier reads may be stale."""
    config = project.config
    if not project.opted_in(config):
        return
    record = project.record()
    if record is None or project.spent(record["event_id"]):
        return
    event_id = record["event_id"]
    verdict, detail = gate(project, record, now_epoch())
    if verdict == "error":
        project.log_error_once(event_id, detail)
    elif verdict == "spend":
        project.spend(event_id, detail)
        project.log_event("skipped", event_id, reason=detail)
    elif verdict == "go":
        claude_bin = resolve_claude(config)
        if claude_bin is None:
            project.log_error_once(event_id, "claude_not_found")
            notify("Quota reset reached but claude was not found; mission not resumed.")
            return
        resume(project, record, claude_bin)


def cmd_tick(project: Project) -> int:
    if not project.opted_in(project.config):
        return 0
    record = project.record()
    if record is None or project.spent(record["event_id"]):
        return 0
    fd = take_lock(project)
    if fd is None:
        return 0
    try:
        tick_locked(project)
    finally:
        release_lock(project, fd)
    return 0


# ── CLI ───────────────────────────────────────────────────────────────────────

def parse_args(argv: list[str]) -> argparse.Namespace:
    default_root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("install", "uninstall", "status", "tick"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--project", default=str(default_root))
        if name == "status":
            cmd.add_argument("--json", action="store_true", dest="as_json")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr,
                        format="%(name)s: %(levelname)s: %(message)s")
    args = parse_args(sys.argv[1:] if argv is None else argv)
    project = Project(Path(args.project).resolve())
    if args.command == "tick":
        try:
            return cmd_tick(project)
        except Exception:  # noqa: BLE001 -- a tick must never fail its launchd job
            log.exception("tick failed for %s", project.root)
            return 0
    if args.command == "install":
        return cmd_install(project)
    if args.command == "uninstall":
        return cmd_uninstall(project)
    return cmd_status(project, args.as_json)


if __name__ == "__main__":
    sys.exit(main())
