#!/usr/bin/env python3
"""Third-party module guard for harness entrypoints.

A `brew upgrade` can swap the python3 on PATH for a new minor version whose
site-packages hold none of PyYAML, jsonschema or chromadb. Entrypoints call
``require("yaml", "jsonschema")`` before importing them:

  1. every module imports       -> return True
  2. the venv (ATHANOR_BRAIN_VENV, default ~/.athanor-env) has them and is not
     the running interpreter    -> re-exec once into it, same argv
  3. otherwise                  -> one plain stderr message naming the missing
     module, the interpreter and the fix, then exit 2 (``fatal=False`` returns
     False instead, for callers that must keep running to report the problem)

Steps 2 and 3 apply only when the caller is __main__ run from a real file.
When imported (or run via -c/-m/stdin) require() raises ModuleNotFoundError
with the same message and never execs or exits.

ATHANOR_PYDEPS_REEXEC=1 marks a re-exec'd process. It is read once at import
and removed from the environment, so a venv that also lacks the module fails
once instead of looping, and children are not affected.
"""
import importlib
import os
import subprocess
import sys

VENV_ENV = "ATHANOR_BRAIN_VENV"
VENV_DEFAULT = "~/.athanor-env"
REEXEC_ENV = "ATHANOR_PYDEPS_REEXEC"
PROBE_TIMEOUT_SECONDS = 5
EXIT_MISSING = 2
PIP_NAMES = {"yaml": "pyyaml"}

# Read once and removed, so the loop guard holds for this process without
# leaking into children, which must be free to re-exec on their own.
_REEXECED = os.environ.pop(REEXEC_ENV, None) == "1"


def _venv_dir():
    return os.path.expanduser(os.environ.get(VENV_ENV, VENV_DEFAULT))


def _venv_python(venv):
    sub, exe = ("Scripts", "python.exe") if os.name == "nt" else ("bin", "python3")
    return os.path.join(venv, sub, exe)


def _missing(modules):
    missing = []
    for name in modules:
        try:
            importlib.import_module(name)
        except ImportError:
            missing.append(name)
    return missing


def _in_venv(venv):
    # sys.prefix, not the binary: a --symlinks venv shares its binary with the
    # base interpreter but not its site-packages.
    return os.path.realpath(sys.prefix) == os.path.realpath(venv)


def _venv_has(venv_python, modules):
    probe = "import " + ", ".join(modules)
    try:
        result = subprocess.run([venv_python, "-c", probe], capture_output=True,
                                timeout=PROBE_TIMEOUT_SECONDS)
    except (OSError, subprocess.SubprocessError):
        return False
    return result.returncode == 0


def _try_reexec(modules):
    if _REEXECED:
        return
    venv = _venv_dir()
    venv_python = _venv_python(venv)
    if not os.path.isfile(venv_python) or _in_venv(venv):
        return
    if not _venv_has(venv_python, modules):
        return
    os.environ[REEXEC_ENV] = "1"
    os.execv(venv_python, [venv_python] + sys.argv)


def _message(missing):
    pip_names = " ".join(PIP_NAMES.get(m, m) for m in missing)
    venv = _venv_dir()
    return (
        "ERROR: Python module(s) not importable: %s\n"
        "  interpreter: %s (Python %s)\n"
        "  fix: %s -m pip install %s\n"
        "  or rebuild the venv %s with a supported python3 and "
        "`pip install pyyaml jsonschema chromadb`"
        " (override its location with %s)"
        % (", ".join(missing), sys.executable, sys.version.split()[0],
           sys.executable, pip_names, venv, VENV_ENV))


def _called_from_script():
    """True only when the caller is the __main__ module run from a real file.

    Re-exec rebuilds argv from sys.argv, which would lose -c source, and a
    module that is merely imported must not restart its importer.
    """
    caller = sys._getframe(2).f_globals.get("__name__")
    return caller == "__main__" and os.path.isfile(sys.argv[0])


def require(*modules, fatal=True):
    """Ensure every module imports.

    Run as a script, re-exec into the venv when it has them, else exit 2.
    Imported (or run via -c/-m/stdin), never exec or exit: raise
    ModuleNotFoundError so the importer decides.
    """
    missing = _missing(modules)
    if not missing:
        return True
    is_script = _called_from_script()
    if is_script:
        _try_reexec(modules)
    if not fatal:
        return False
    if is_script:
        print(_message(missing), file=sys.stderr)
        sys.exit(EXIT_MISSING)
    raise ModuleNotFoundError(_message(missing), name=missing[0])
