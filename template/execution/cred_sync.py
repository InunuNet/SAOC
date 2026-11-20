#!/usr/bin/env python3
"""cred_sync.py -- move project credentials between operator-registered machines.

Agents never read or print credential values; this tool copies only:
  - regular files at project root named `.env` or `.env.*`
  - regular files inside `.agent/secrets/`

Hosts and project mappings live in `.agent/cred_sync_hosts.json` (operator-owned).
Exit codes: 0 all OK, 1 any transfer/verify failed, 2 usage/registry/refusal.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
LOCAL_ROOT = ROOT.parent
REGISTRY_REL = Path(".agent") / "cred_sync_hosts.json"
TELEMETRY_REL = Path(".agent") / "memory" / "project" / "telemetry" / "cred_sync.jsonl"

EXIT_OK = 0
EXIT_FAIL = 1
EXIT_REFUSED = 2

OPERATOR_CREATE_HINT = (
    "! cat > .agent/cred_sync_hosts.json <<'EOF'\n"
    '{"hosts": {"liamacbook": {"ssh": "liamacbook", "projects": '
    '{"Athanor": "ai/Athanor"}}}}\n'
    "EOF"
)

_CTRL_RE = re.compile(r"[\x00-\x1f\x7f]")
_WIN_ABS_RE = re.compile(r"^[A-Za-z]:")
_NAME_RE = re.compile(r"^[A-Za-z0-9._@+-]+$")
_SSH_TARGET_RE = re.compile(r"^[A-Za-z0-9._@-]+$")
_DIGEST_RE = re.compile(r"^[0-9a-f]{64}$")
EXIT_REMOTE_SYMLINK = 3
STAGE_PREFIX = ".cred_sync_stage-"
SECRETS_PREFIX = ".agent/secrets/"


def refuse(message: str) -> int:
    sys.stderr.write(f"cred_sync: refused: {message}\n")
    return EXIT_REFUSED


def warn(message: str) -> None:
    sys.stderr.write(f"WARN: {message}\n")


def _validate_local_project(name: object) -> str | None:
    if not isinstance(name, str) or not name:
        return "local project name must be a non-empty string"
    if _CTRL_RE.search(name) or name in (".", ".."):
        return f"invalid local project name {name!r}"
    if "/" in name or "\\" in name or ".." in name:
        return f"local project name must not contain '/' or '..': {name!r}"
    return None


def _validate_remote_dir(remote_dir: object) -> str | None:
    if not isinstance(remote_dir, str) or not remote_dir or not remote_dir.strip():
        return "remote dir must not be empty"
    if _CTRL_RE.search(remote_dir):
        return f"remote dir contains control characters: {remote_dir!r}"
    if remote_dir.startswith("/") or remote_dir.startswith("~") or _WIN_ABS_RE.match(remote_dir):
        return f"remote dir must be relative to remote $HOME (not absolute): {remote_dir!r}"
    if "\\" in remote_dir or ".." in remote_dir:
        return f"remote dir must not contain '..' or backslashes: {remote_dir!r}"
    for segment in remote_dir.rstrip("/").split("/"):
        if segment in (".", "..") or segment.startswith("-") or not _NAME_RE.match(segment):
            return f"remote dir has an invalid path segment: {remote_dir!r}"
    return None


def _validate_ssh_target(ssh_target: object) -> str | None:
    if not isinstance(ssh_target, str) or not ssh_target:
        return "host entry missing valid 'ssh' target"
    if _CTRL_RE.search(ssh_target) or any(c.isspace() for c in ssh_target):
        return f"invalid ssh target {ssh_target!r}"
    if ssh_target.startswith("-") or not _SSH_TARGET_RE.match(ssh_target):
        return f"invalid ssh target {ssh_target!r}"
    return None


def load_registry() -> tuple[dict | None, int]:
    reg_path = ROOT / REGISTRY_REL
    try:
        st = reg_path.lstat()
    except FileNotFoundError:
        sys.stderr.write(
            f"cred_sync: refused: registry {REGISTRY_REL.as_posix()} is missing.\n"
            f"Ask the operator to create it:\n  {OPERATOR_CREATE_HINT}\n"
        )
        return None, EXIT_REFUSED
    except OSError as exc:
        sys.stderr.write(
            f"cred_sync: refused: registry {REGISTRY_REL.as_posix()} is unreadable "
            f"({type(exc).__name__}).\n"
            f"Ask the operator to create/fix it:\n  {OPERATOR_CREATE_HINT}\n"
        )
        return None, EXIT_REFUSED

    if not stat.S_ISREG(st.st_mode):
        return None, refuse(f"registry {REGISTRY_REL.as_posix()} must be a regular file")

    try:
        raw = reg_path.read_text(encoding="utf-8")
    except OSError as exc:
        sys.stderr.write(
            f"cred_sync: refused: cannot read {REGISTRY_REL.as_posix()} ({type(exc).__name__}).\n"
            f"Ask the operator to create/fix it:\n  {OPERATOR_CREATE_HINT}\n"
        )
        return None, EXIT_REFUSED

    try:
        data = json.loads(raw)
    except ValueError:
        return None, refuse(f"registry {REGISTRY_REL.as_posix()} is not valid JSON")

    if not isinstance(data, dict) or not isinstance(data.get("hosts"), dict):
        return None, refuse(f"registry {REGISTRY_REL.as_posix()} must have a 'hosts' object")
    return data["hosts"], EXIT_OK


def resolve_host_and_projects(
    hosts: dict, host: str, requested_projects: list[str]
) -> tuple[str | None, list[tuple[str, str]] | None, int]:
    if host not in hosts or not isinstance(hosts[host], dict):
        return None, None, refuse(f"host {host!r} is not in {REGISTRY_REL.as_posix()}")

    entry = hosts[host]
    err = _validate_ssh_target(entry.get("ssh"))
    if err:
        return None, None, refuse(err)
    ssh_target = entry["ssh"]

    projects_map = entry.get("projects")
    if not isinstance(projects_map, dict) or not projects_map:
        return None, None, refuse(f"host {host!r} has no mapped projects")

    if requested_projects:
        selected_names: list[str] = []
        seen: set[str] = set()
        for name in requested_projects:
            err = _validate_local_project(name)
            if err:
                return None, None, refuse(err)
            if name not in projects_map:
                return None, None, refuse(f"project {name!r} is not mapped for host {host!r}")
            if name not in seen:
                seen.add(name)
                selected_names.append(name)
    else:
        selected_names = list(projects_map.keys())

    pairs: list[tuple[str, str]] = []
    for local_proj in selected_names:
        err = _validate_local_project(local_proj)
        if err:
            return None, None, refuse(err)
        remote_dir = projects_map[local_proj]
        err = _validate_remote_dir(remote_dir)
        if err:
            return None, None, refuse(f"project {local_proj!r}: {err}")
        pairs.append((local_proj, remote_dir.rstrip("/")))

    return ssh_target, pairs, EXIT_OK


def _is_dotenv_name(name: str) -> bool:
    return name == ".env" or name.startswith(".env.")


def collect_local_candidates(local_proj: str) -> tuple[list[str], list[str]]:
    """Return (root_files, secret_files) relative to local_dir; warn and skip symlinks/non-regular."""
    local_dir = LOCAL_ROOT / local_proj
    try:
        st = local_dir.lstat()
    except FileNotFoundError:
        warn(f"local project directory {local_proj} does not exist; skipping")
        return [], []
    except OSError as exc:
        warn(f"cannot stat local project directory {local_proj} ({type(exc).__name__}); skipping")
        return [], []

    if stat.S_ISLNK(st.st_mode) or not stat.S_ISDIR(st.st_mode):
        warn(f"skipping non-directory or symlinked project {local_proj}")
        return [], []

    root_files: list[str] = []
    for entry in sorted(local_dir.iterdir(), key=lambda p: p.name):
        if not _is_dotenv_name(entry.name):
            continue
        if not _NAME_RE.match(entry.name):
            warn(f"skipping {local_proj} file with unsafe name {entry.name!r}")
            continue
        est = entry.lstat()
        if stat.S_ISLNK(est.st_mode):
            warn(f"skipping symlink {local_proj}/{entry.name}")
            continue
        if not stat.S_ISREG(est.st_mode):
            warn(f"skipping non-regular file {local_proj}/{entry.name}")
            continue
        root_files.append(entry.name)

    secret_files: list[str] = []
    agent_dir = local_dir / ".agent"
    try:
        ast = agent_dir.lstat()
    except FileNotFoundError:
        return root_files, secret_files
    except OSError:
        warn(f"cannot stat {local_proj}/.agent; skipping secrets")
        return root_files, secret_files

    if stat.S_ISLNK(ast.st_mode):
        warn(f"skipping symlink {local_proj}/.agent")
        return root_files, secret_files
    if not stat.S_ISDIR(ast.st_mode):
        warn(f"skipping non-directory {local_proj}/.agent")
        return root_files, secret_files

    secrets_dir = agent_dir / "secrets"
    try:
        sst = secrets_dir.lstat()
    except FileNotFoundError:
        return root_files, secret_files
    except OSError:
        warn(f"cannot stat {local_proj}/.agent/secrets; skipping secrets")
        return root_files, secret_files

    if stat.S_ISLNK(sst.st_mode):
        warn(f"skipping symlink {local_proj}/.agent/secrets")
        return root_files, secret_files
    if not stat.S_ISDIR(sst.st_mode):
        warn(f"skipping non-regular {local_proj}/.agent/secrets")
        return root_files, secret_files

    for entry in sorted(secrets_dir.iterdir(), key=lambda p: p.name):
        if not _NAME_RE.match(entry.name):
            warn(f"skipping {local_proj} secret with unsafe name {entry.name!r}")
            continue
        est = entry.lstat()
        rel = f"{SECRETS_PREFIX}{entry.name}"
        if stat.S_ISLNK(est.st_mode):
            warn(f"skipping symlink {local_proj}/{rel}")
            continue
        if not stat.S_ISREG(est.st_mode):
            warn(f"skipping non-regular file {local_proj}/{rel}")
            continue
        secret_files.append(rel)

    return root_files, secret_files


def _run_transport(argv: list[str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    """Run ssh/rsync/scp capturing output; caller must never print stderr verbatim."""
    return subprocess.run(
        argv,
        cwd=str(cwd) if cwd else None,
        stdin=subprocess.DEVNULL,
        capture_output=True,
        text=True,
    )


def _ssh_run(ssh_target: str, remote_cmd: str) -> subprocess.CompletedProcess[str]:
    # Run under POSIX sh, never the remote login shell: zsh (the macOS default) aborts the whole
    # script when a dotfile glob in the probe matches nothing, so verify failed on zsh hosts.
    return _run_transport(
        ["ssh", "-o", "BatchMode=yes", ssh_target, "sh -c " + shlex.quote(remote_cmd)]
    )


def _has_rsync() -> bool:
    return shutil.which("rsync") is not None


def _copy_files_to_remote(
    ssh_target: str,
    cwd: Path,
    src_names: list[str],
    remote_dest_dir: str,
    use_rsync: bool,
) -> int:
    if not src_names:
        return 0
    src_args = [f"./{n}" for n in src_names]
    dest = f"{ssh_target}:{shlex.quote(remote_dest_dir)}/"
    if use_rsync:
        argv = ["rsync", "-pt", "-e", "ssh -o BatchMode=yes", *src_args, dest]
    else:
        argv = ["scp", "-p", "-o", "BatchMode=yes", *src_args, dest]
    proc = _run_transport(argv, cwd=cwd)
    return proc.returncode


def _copy_file_from_remote(
    ssh_target: str, remote_base: str, rel: str, dest_dir: Path, use_rsync: bool
) -> int:
    """Fetch one validated rel into dest_dir (no symlink or directory recursion)."""
    src = f"{ssh_target}:{shlex.quote(f'{remote_base}/{rel}')}"
    dest = f"{dest_dir}/"
    if use_rsync:
        argv = ["rsync", "-pt", "-e", "ssh -o BatchMode=yes", src, dest]
    else:
        argv = ["scp", "-p", "-o", "BatchMode=yes", src, dest]
    return _run_transport(argv).returncode


def _remote_probe_script(remote_dir: str, with_hash: bool) -> str:
    rdir_q = shlex.quote(remote_dir)
    hash_fn = ""
    emit_file = 'printf \'FILE\\t%s\\n\' "$2"'
    if with_hash:
        hash_fn = (
            "hash_file() {\n"
            "  if command -v sha256sum >/dev/null 2>&1; then\n"
            '    o=$(sha256sum "$1") || return 1\n'
            "  elif command -v shasum >/dev/null 2>&1; then\n"
            '    o=$(shasum -a 256 "$1") || return 1\n'
            "  elif command -v openssl >/dev/null 2>&1; then\n"
            '    o=$(openssl dgst -sha256 "$1") || return 1\n'
            '    o=${o##* }\n'
            "  else\n"
            '    o=$(python3 -c \'import hashlib,sys; '
            'print(hashlib.sha256(open(sys.argv[1],"rb").read()).hexdigest())\' "$1") || return 1\n'
            "  fi\n"
            '  o=${o%% *}\n'
            '  case "$o" in ""|*[!0-9a-f]*) return 1 ;; esac\n'
            '  [ "${#o}" -eq 64 ] || return 1\n'
            "  printf '%s' \"$o\"\n"
            "}\n"
        )
        emit_file = 'h=$(hash_file "$1") || exit 1; printf \'HASH\\t%s\\t%s\\n\' "$2" "$h"'

    return (
        f'd="$HOME/"{rdir_q}\n'
        f"{hash_fn}"
        'emit_file() {\n'
        f"  {emit_file}\n"
        "}\n"
        'if [ -L "$d" ] || [ ! -d "$d" ]; then\n'
        '  printf \'NO_DIR\\n\'\n'
        "  exit 0\n"
        "fi\n"
        'for f in "$d"/.env "$d"/.env.*; do\n'
        '  [ -e "$f" ] || [ -L "$f" ] || continue\n'
        '  b=${f##*/}\n'
        '  if [ -L "$f" ]; then printf \'SKIP_SYMLINK\\t%s\\n\' "$b"\n'
        '  elif [ -f "$f" ]; then emit_file "$f" "$b"\n'
        '  else printf \'SKIP_NONREG\\t%s\\n\' "$b"\n'
        "  fi\n"
        "done\n"
        'if [ -L "$d/.agent" ]; then\n'
        "  printf 'SKIP_SYMLINK\\t.agent\\n'\n"
        'elif [ -L "$d/.agent/secrets" ]; then\n'
        "  printf 'SKIP_SYMLINK\\t.agent/secrets\\n'\n"
        'elif [ -e "$d/.agent/secrets" ] && [ ! -d "$d/.agent/secrets" ]; then\n'
        "  printf 'SKIP_NONREG\\t.agent/secrets\\n'\n"
        'elif [ -d "$d/.agent/secrets" ]; then\n'
        '  for f in "$d/.agent/secrets"/* "$d/.agent/secrets"/.[!.]* "$d/.agent/secrets"/..?*; do\n'
        '    [ -e "$f" ] || [ -L "$f" ] || continue\n'
        '    b=${f##*/}\n'
        '    if [ -L "$f" ]; then printf \'SKIP_SYMLINK\\t.agent/secrets/%s\\n\' "$b"\n'
        '    elif [ -f "$f" ]; then emit_file "$f" ".agent/secrets/$b"\n'
        '    else printf \'SKIP_NONREG\\t.agent/secrets/%s\\n\' "$b"\n'
        "    fi\n"
        "  done\n"
        "fi\n"
    )


def _is_valid_rel(rel: str) -> bool:
    if rel.startswith(SECRETS_PREFIX):
        base = rel[len(SECRETS_PREFIX):]
        return base not in (".", "..") and bool(_NAME_RE.match(base))
    return (rel == ".env" or rel.startswith(".env.")) and bool(_NAME_RE.match(rel))


def _accept_probe_rel(
    local_proj: str, rel: str, root_files: list[str], secret_files: list[str]
) -> bool:
    if not _is_valid_rel(rel):
        warn(f"dropping unexpected remote entry for {local_proj}: {rel!r}")
        return False
    (secret_files if rel.startswith(SECRETS_PREFIX) else root_files).append(rel)
    return True


def _parse_probe_output(
    local_proj: str, stdout: str, with_hash: bool
) -> tuple[bool, list[str], list[str], dict[str, str]]:
    """Return (dir_exists, root_files, secret_files, hashes)."""
    root_files: list[str] = []
    secret_files: list[str] = []
    hashes: dict[str, str] = {}
    dir_exists = True
    for line in stdout.splitlines():
        if not line:
            continue
        if line == "NO_DIR":
            dir_exists = False
            continue
        parts = line.split("\t")
        tag = parts[0]
        if tag == "SKIP_SYMLINK" and len(parts) >= 2:
            warn(f"skipping remote symlink {local_proj}/{parts[1]}")
        elif tag == "SKIP_NONREG" and len(parts) >= 2:
            warn(f"skipping remote non-regular file {local_proj}/{parts[1]}")
        elif tag == "FILE" and not with_hash and len(parts) >= 2:
            _accept_probe_rel(local_proj, parts[1], root_files, secret_files)
        elif tag == "HASH" and with_hash and len(parts) >= 3:
            rel, digest = parts[1], parts[2]
            if not _DIGEST_RE.match(digest):
                warn(f"dropping remote entry with invalid digest {local_proj}/{rel!r}")
            elif _accept_probe_rel(local_proj, rel, root_files, secret_files):
                hashes[rel] = digest
    return dir_exists, sorted(root_files), sorted(secret_files), hashes


def _append_telemetry(action: str, host: str, project: str, files: list[str], ok: bool) -> None:
    log_path = ROOT / TELEMETRY_REL
    log_path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "action": action,
        "host": host,
        "project": project,
        "files": files,
        "ok": ok,
    }
    payload = (json.dumps(record, separators=(",", ":")) + "\n").encode("utf-8")
    flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(str(log_path), flags, 0o644)
    except OSError:
        return
    try:
        os.write(fd, payload)
    finally:
        os.close(fd)


def _ensure_safe_local_dest_file(local_dir: Path, local_proj: str, rel: str) -> bool:
    target = local_dir / rel
    try:
        st = target.lstat()
    except FileNotFoundError:
        return True
    except OSError:
        warn(f"cannot stat local {local_proj}/{rel}; skipping")
        return False
    if stat.S_ISLNK(st.st_mode):
        warn(f"skipping pull over local symlink {local_proj}/{rel}")
        return False
    if not stat.S_ISREG(st.st_mode):
        warn(f"skipping pull over local non-regular file {local_proj}/{rel}")
        return False
    return True


def _ensure_safe_local_dir(path: Path, label: str) -> bool:
    try:
        st = path.lstat()
    except FileNotFoundError:
        path.mkdir(parents=True, exist_ok=True)
        return True
    except OSError:
        warn(f"cannot stat local directory {label}")
        return False
    if stat.S_ISLNK(st.st_mode) or not stat.S_ISDIR(st.st_mode):
        warn(f"skipping symlink or non-directory {label}")
        return False
    return True


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def cmd_hosts(_args: argparse.Namespace) -> int:
    hosts, rc = load_registry()
    if rc != EXIT_OK or hosts is None:
        return rc
    if not hosts:
        print("no hosts registered")
        return EXIT_OK
    for host in sorted(hosts.keys()):
        entry = hosts[host]
        if not isinstance(entry, dict):
            continue
        ssh_target = entry.get("ssh", "?")
        projs = entry.get("projects")
        names = ", ".join(sorted(projs.keys())) if isinstance(projs, dict) else ""
        print(f"{host} (ssh={ssh_target}): {names}")
    return EXIT_OK


def _make_staging(agent_dir: Path) -> Path:
    agent_dir.mkdir(parents=True, exist_ok=True)
    return Path(tempfile.mkdtemp(prefix=STAGE_PREFIX, dir=str(agent_dir)))


def _stage_local_files(local_dir: Path, rels: list[str], staging: Path) -> list[str]:
    """Copy each candidate via O_NOFOLLOW into staging (mode 600); return staged rels."""
    staged: list[str] = []
    for rel in rels:
        dest = staging / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            fd = os.open(str(local_dir / rel), os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        except OSError as exc:
            warn(f"skipping {rel!r}: cannot open without following links ({type(exc).__name__})")
            continue
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode):
                warn(f"skipping non-regular file {rel!r}")
                continue
            out_fd = os.open(str(dest), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(out_fd, "wb") as out, os.fdopen(os.dup(fd), "rb") as src:
                shutil.copyfileobj(src, out)
        finally:
            os.close(fd)
        staged.append(rel)
    return staged


def _remote_symlink_guard(paths: list[str]) -> str:
    """Shell lines that exit EXIT_REMOTE_SYMLINK if `$d` or any `$d`-relative path is a symlink."""
    lines = [f'if [ -L "$d" ]; then exit {EXIT_REMOTE_SYMLINK}; fi']
    for path in paths:
        lines.append(f'if [ -L "$d/"{shlex.quote(path)} ]; then exit {EXIT_REMOTE_SYMLINK}; fi')
    return "\n".join(lines)


def _guard_paths(has_secrets: bool, files: list[str]) -> list[str]:
    return ([".agent", ".agent/secrets"] if has_secrets else []) + files


def _push_prep_script(remote_dir: str, has_secrets: bool, files: list[str]) -> str:
    # Guard before any mkdir: `mkdir -p` follows a symlinked `.agent` and would create
    # `secrets/` in its target before the post-mkdir guard could refuse (QA round 2).
    lines = [
        f'd="$HOME/"{shlex.quote(remote_dir)}',
        _remote_symlink_guard(_guard_paths(has_secrets, files)),
    ]
    lines.append('mkdir -p "$d" || exit 1')
    if has_secrets:
        lines.append('mkdir -p "$d/.agent/secrets" || exit 1')
    lines.append(_remote_symlink_guard(_guard_paths(has_secrets, files)))
    return "\n".join(lines) + "\n"


def _push_chmod_script(remote_dir: str, has_secrets: bool, files: list[str]) -> str:
    lines = [
        f'd="$HOME/"{shlex.quote(remote_dir)}',
        _remote_symlink_guard(_guard_paths(has_secrets, files)),
    ]
    if has_secrets:
        lines.append('chmod 700 "$d/.agent/secrets" || exit 1')
    for rel in files:
        lines.append(f'chmod 600 "$d/"{shlex.quote(rel)} || exit 1')
    return "\n".join(lines) + "\n"


def _fail_reason(rc: int, what: str) -> str:
    if rc == EXIT_REMOTE_SYMLINK:
        return "refused: remote symlink in destination path"
    return f"{what} failed (code {rc})"


def _push_project(
    args: argparse.Namespace, ssh_target: str, local_proj: str, remote_dir: str,
    all_files: list[str], use_rsync: bool,
) -> bool:
    local_dir = LOCAL_ROOT / local_proj
    tool_name = "rsync" if use_rsync else "scp"
    staging = _make_staging(ROOT / ".agent")
    try:
        files = _stage_local_files(local_dir, all_files, staging)
        if len(files) != len(all_files):
            warn(f"{local_proj}: some candidates changed after collection; push aborted")
            return False
        root_files = [f for f in files if not f.startswith(SECRETS_PREFIX)]
        secret_files = [f for f in files if f.startswith(SECRETS_PREFIX)]
        prep = _ssh_run(ssh_target, _push_prep_script(remote_dir, bool(secret_files), files))
        if prep.returncode != 0:
            sys.stderr.write(
                f"FAIL push {args.host} {local_proj}: {_fail_reason(prep.returncode, 'ssh')}\n"
            )
            return False
        copy_rc = _copy_files_to_remote(ssh_target, staging, root_files, remote_dir, use_rsync)
        if copy_rc == 0 and secret_files:
            copy_rc = _copy_files_to_remote(
                ssh_target,
                staging / ".agent" / "secrets",
                [rel[len(SECRETS_PREFIX):] for rel in secret_files],
                f"{remote_dir}/.agent/secrets",
                use_rsync,
            )
        if copy_rc != 0:
            sys.stderr.write(
                f"FAIL push {args.host} {local_proj}: {tool_name} failed (code {copy_rc})\n"
            )
            return False
        ch = _ssh_run(ssh_target, _push_chmod_script(remote_dir, bool(secret_files), files))
        if ch.returncode != 0:
            sys.stderr.write(
                f"FAIL push {args.host} {local_proj}: "
                f"{_fail_reason(ch.returncode, 'ssh chmod')}\n"
            )
            return False
        return True
    finally:
        shutil.rmtree(staging, ignore_errors=True)


def cmd_push(args: argparse.Namespace) -> int:
    hosts, rc = load_registry()
    if rc != EXIT_OK or hosts is None:
        return rc
    ssh_target, pairs, rc = resolve_host_and_projects(hosts, args.host, args.projects)
    if rc != EXIT_OK or ssh_target is None or pairs is None:
        return rc

    use_rsync = _has_rsync()
    any_failed = False

    for local_proj, remote_dir in pairs:
        root_files, secret_files = collect_local_candidates(local_proj)
        all_files = root_files + secret_files
        if args.dry_run:
            names = ", ".join(all_files) if all_files else "none"
            print(f"DRY-RUN push {args.host} {local_proj}: {len(all_files)} file(s) ({names})")
            continue

        if not all_files:
            print(f"OK push {args.host} {local_proj}: 0 file(s)")
            _append_telemetry("push", args.host, local_proj, [], True)
            continue

        ok = _push_project(args, ssh_target, local_proj, remote_dir, all_files, use_rsync)
        _append_telemetry("push", args.host, local_proj, all_files, ok)
        if not ok:
            any_failed = True
            continue
        print(f"OK push {args.host} {local_proj}: {len(all_files)} file(s) ({', '.join(all_files)})")

    return EXIT_FAIL if any_failed else EXIT_OK


def _install_staged(staged: Path, dest: Path, rel: str) -> bool:
    """Move one staged regular file onto dest; discard anything else."""
    try:
        st = staged.lstat()
    except OSError:
        warn(f"discarding {rel!r}: nothing staged")
        return False
    if not stat.S_ISREG(st.st_mode):
        warn(f"discarding {rel!r}: staged entry is not a regular file")
        return False
    try:
        dst = dest.lstat()
    except FileNotFoundError:
        dst = None
    if dst is not None and not stat.S_ISREG(dst.st_mode):
        warn(f"discarding {rel!r}: local destination is not a regular file")
        return False
    os.chmod(staged, 0o600)
    os.replace(staged, dest)
    return True


def _pull_files(
    ssh_target: str, remote_dir: str, local_dir: Path, rels: list[str], use_rsync: bool,
    staging: Path,
) -> tuple[list[str], int]:
    """Pull rels through staging; return (installed rels, transport rc)."""
    installed: list[str] = []
    for idx, rel in enumerate(rels):
        stage_sub = staging / str(idx)
        stage_sub.mkdir(mode=0o700)
        rc = _copy_file_from_remote(ssh_target, remote_dir, rel, stage_sub, use_rsync)
        if rc != 0:
            return installed, rc
        if _install_staged(stage_sub / rel.rsplit("/", 1)[-1], local_dir / rel, rel):
            installed.append(rel)
    return installed, 0


def _prepare_pull_dirs(local_dir: Path, local_proj: str, has_secrets: bool) -> bool:
    if not _ensure_safe_local_dir(local_dir, local_proj):
        return False
    if not _ensure_safe_local_dir(local_dir / ".agent", f"{local_proj}/.agent"):
        return False
    if has_secrets:
        secrets = local_dir / ".agent" / "secrets"
        if not _ensure_safe_local_dir(secrets, f"{local_proj}/.agent/secrets"):
            return False
        os.chmod(secrets, 0o700)
    return True


def cmd_pull(args: argparse.Namespace) -> int:
    hosts, rc = load_registry()
    if rc != EXIT_OK or hosts is None:
        return rc
    ssh_target, pairs, rc = resolve_host_and_projects(hosts, args.host, args.projects)
    if rc != EXIT_OK or ssh_target is None or pairs is None:
        return rc

    use_rsync = _has_rsync()
    tool_name = "rsync" if use_rsync else "scp"
    any_failed = False

    for local_proj, remote_dir in pairs:
        probe = _ssh_run(ssh_target, _remote_probe_script(remote_dir, with_hash=False))
        if probe.returncode != 0:
            sys.stderr.write(
                f"FAIL pull {args.host} {local_proj}: ssh failed (code {probe.returncode})\n"
            )
            if not args.dry_run:
                _append_telemetry("pull", args.host, local_proj, [], False)
            any_failed = True
            continue

        dir_exists, root_files, secret_files, _ = _parse_probe_output(
            local_proj, probe.stdout, with_hash=False
        )
        if not dir_exists:
            warn(f"remote project directory {remote_dir} does not exist on {args.host}")

        local_dir = LOCAL_ROOT / local_proj
        all_files = [
            f for f in root_files + secret_files
            if _ensure_safe_local_dest_file(local_dir, local_proj, f)
        ]

        if args.dry_run:
            names = ", ".join(all_files) if all_files else "none"
            print(f"DRY-RUN pull {args.host} {local_proj}: {len(all_files)} file(s) ({names})")
            continue

        if not all_files:
            print(f"OK pull {args.host} {local_proj}: 0 file(s)")
            _append_telemetry("pull", args.host, local_proj, [], True)
            continue

        has_secrets = any(f.startswith(SECRETS_PREFIX) for f in all_files)
        if not _prepare_pull_dirs(local_dir, local_proj, has_secrets):
            _append_telemetry("pull", args.host, local_proj, all_files, False)
            any_failed = True
            continue

        staging = _make_staging(local_dir / ".agent")
        try:
            installed, copy_rc = _pull_files(
                ssh_target, remote_dir, local_dir, all_files, use_rsync, staging
            )
        finally:
            shutil.rmtree(staging, ignore_errors=True)
        if copy_rc != 0:
            sys.stderr.write(
                f"FAIL pull {args.host} {local_proj}: {tool_name} failed (code {copy_rc})\n"
            )
            _append_telemetry("pull", args.host, local_proj, installed, False)
            any_failed = True
            continue

        print(f"OK pull {args.host} {local_proj}: {len(installed)} file(s) ({', '.join(installed)})")
        _append_telemetry("pull", args.host, local_proj, installed, True)

    return EXIT_FAIL if any_failed else EXIT_OK


def cmd_verify(args: argparse.Namespace) -> int:
    hosts, rc = load_registry()
    if rc != EXIT_OK or hosts is None:
        return rc
    ssh_target, pairs, rc = resolve_host_and_projects(hosts, args.host, args.projects)
    if rc != EXIT_OK or ssh_target is None or pairs is None:
        return rc

    any_issue = False
    for local_proj, remote_dir in pairs:
        local_root, local_secrets = collect_local_candidates(local_proj)
        local_dir = LOCAL_ROOT / local_proj
        local_hashes = {
            rel: _sha256_file(local_dir / rel) for rel in (local_root + local_secrets)
        }

        probe = _ssh_run(ssh_target, _remote_probe_script(remote_dir, with_hash=True))
        if probe.returncode != 0:
            sys.stderr.write(
                f"FAIL verify {args.host} {local_proj}: ssh failed (code {probe.returncode})\n"
            )
            any_issue = True
            continue

        _, _, _, remote_hashes = _parse_probe_output(local_proj, probe.stdout, with_hash=True)
        union_files = sorted(set(local_hashes.keys()) | set(remote_hashes.keys()))
        if not union_files:
            print(f"{local_proj}: 0 files (match)")
            continue
        for rel in union_files:
            lh = local_hashes.get(rel)
            rh = remote_hashes.get(rel)
            if lh is None or rh is None:
                print(f"{local_proj}: {rel}: missing")
                any_issue = True
            elif lh == rh:
                print(f"{local_proj}: {rel}: match")
            else:
                print(f"{local_proj}: {rel}: differs")
                any_issue = True

    return EXIT_FAIL if any_issue else EXIT_OK


def _flatten_projects(raw: list[list[str]] | None) -> list[str]:
    if not raw:
        return []
    return [item for group in raw for item in group]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cred_sync.py",
        description="Move project credentials between registered machines without printing values.",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    sub.add_parser("hosts", help="list registered hosts and mapped projects").set_defaults(
        func=cmd_hosts
    )

    for name, help_text, handler in (
        ("push", "copy local credentials to a registered host", cmd_push),
        ("pull", "copy credentials from a registered host to local projects", cmd_pull),
    ):
        p = sub.add_parser(name, help=help_text)
        p.add_argument("host", help="host key in .agent/cred_sync_hosts.json")
        p.add_argument(
            "--project",
            action="append",
            nargs="+",
            dest="project_groups",
            metavar="LOCAL",
            help="limit to one or more mapped local project directory names",
        )
        p.add_argument("--dry-run", action="store_true", help="list candidates without copying")
        p.set_defaults(func=handler)

    vp = sub.add_parser("verify", help="compare local and remote credential sha256 digests")
    vp.add_argument("host", help="host key in .agent/cred_sync_hosts.json")
    vp.add_argument(
        "--project",
        action="append",
        nargs="+",
        dest="project_groups",
        metavar="LOCAL",
        help="limit to one or more mapped local project directory names",
    )
    vp.set_defaults(func=cmd_verify)
    return parser


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    args.projects = _flatten_projects(getattr(args, "project_groups", None))
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
