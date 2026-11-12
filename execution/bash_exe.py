"""The bash every Python script in the harness spawns.

Bare "bash" is wrong on Windows: CreateProcess searches System32 before PATH,
and on a host with WSL that is the WSL launcher, which fails every command when
no distro is installed (CI windows-latest, 2026-11-11: init.sh, contract shell
assertions and fleet acceptance all died there). Claude Code runs hooks under
Git Bash, so resolve that: ATHANOR_BASH, then the first PATH bash outside
System32, then bash beside git. Elsewhere "bash" is correct and stays bare.

Usage:  from bash_exe import bash_exe;  subprocess.run([bash_exe(), script])
The test layer1_static/test_no_bare_bash_argv.sh fails on any new bare "bash"
argv in execution/*.py, so this cannot regress.
"""
import os
import shutil


def _is_system32(path):
    return "system32" in str(path).lower().replace("/", "\\")


def bash_exe():
    override = os.environ.get("ATHANOR_BASH")
    if override and os.path.exists(override):
        return override
    if os.name != "nt":
        return "bash"
    for entry in os.environ.get("PATH", "").split(os.pathsep):
        if not entry or _is_system32(entry):
            continue
        for name in ("bash.exe", "bash"):
            cand = os.path.join(entry, name)
            if os.path.isfile(cand):
                return cand
    git = shutil.which("git")
    if git:
        root = os.path.dirname(os.path.dirname(os.path.realpath(git)))
        for rel in (("bin", "bash.exe"), ("usr", "bin", "bash.exe")):
            cand = os.path.join(root, *rel)
            if os.path.isfile(cand):
                return cand
    return "bash"


if __name__ == "__main__":
    print(bash_exe())
