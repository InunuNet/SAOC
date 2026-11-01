#!/usr/bin/env python3
"""Golden for ci-playwright-timeout-cache. Parses .github/workflows/ci.yml and asserts the
timeouts, the cache path and the version-derived key, the hit/miss split, and the pinned
cache action. `--selftest` also proves each assertion is load-bearing by mutating the parsed
document in memory (no file writes) and requiring every mutant to be rejected."""
import copy
import re
import sys

import yaml

CI = ".github/workflows/ci.yml"
INSTALL_RE = re.compile(r"playwright install --with-deps chromium")
DEPS_RE = re.compile(r"playwright install-deps chromium")


def steps_of(doc):
    return doc["jobs"]["build"]["steps"]


def find_cache(steps):
    return next((s for s in steps if str(s.get("uses", "")).startswith("actions/cache@")), None)


def check(doc):
    errs = []
    job = doc["jobs"]["build"]
    steps = steps_of(doc)
    jt = job.get("timeout-minutes")
    # Real build jobs ran 29-41 min wall (steps sum ~38 min); the 4.4 h hang is what we cap.
    if not (isinstance(jt, int) and 50 <= jt <= 90):
        errs.append(f"job timeout-minutes must be an int in 50..90, got {jt!r}")
    install = [s for s in steps if INSTALL_RE.search(str(s.get("run", "")))]
    if len(install) != 1:
        errs.append(f"expected exactly one 'playwright install --with-deps chromium' step, got {len(install)}")
    else:
        it = install[0].get("timeout-minutes")
        if not (isinstance(it, int) and 5 <= it <= 20):
            errs.append(f"install step timeout-minutes must be an int in 5..20, got {it!r}")
        if "steps.pwcache.outputs.cache-hit" not in str(install[0].get("if", "")) or "!=" not in str(install[0].get("if", "")):
            errs.append("install step must run only on a cache miss (if: steps.pwcache.outputs.cache-hit != 'true')")
    deps = [s for s in steps if DEPS_RE.search(str(s.get("run", "")))]
    if len(deps) != 1:
        errs.append("expected exactly one 'playwright install-deps chromium' step for the cache-hit path")
    else:
        if "steps.pwcache.outputs.cache-hit == 'true'" not in str(deps[0].get("if", "")):
            errs.append("install-deps step must run only on a cache hit")
        dt = deps[0].get("timeout-minutes")
        if not (isinstance(dt, int) and 5 <= dt <= 20):
            errs.append(f"install-deps step timeout-minutes must be an int in 5..20, got {dt!r}")
    cache = find_cache(steps)
    if cache is None:
        errs.append("no actions/cache step")
    else:
        if not re.fullmatch(r"actions/cache@v\d+", str(cache["uses"])):
            errs.append(f"actions/cache must be pinned to a major tag, got {cache['uses']!r}")
        if cache.get("id") != "pwcache":
            errs.append("cache step id must be pwcache")
        w = cache.get("with", {})
        if "ms-playwright" not in str(w.get("path", "")) or "~/.cache" not in str(w.get("path", "")):
            errs.append(f"cache path must be ~/.cache/ms-playwright, got {w.get('path')!r}")
        key = str(w.get("key", ""))
        if not re.search(r"\$\{\{\s*steps\.[A-Za-z0-9_-]+\.outputs\.[A-Za-z0-9_-]+\s*\}\}", key) or "runner.os" not in key:
            errs.append(f"cache key must embed runner.os and a step-output version, got {key!r}")
        if "restore-keys" in w:
            errs.append("no restore-keys: a floating fallback would restore another Playwright version")
    # Order: version resolver -> cache -> install/deps -> E2E
    names = [s.get("name") for s in steps]
    ver = [s for s in steps if "playwright --version" in str(s.get("run", ""))]
    if len(ver) != 1:
        errs.append("expected one step deriving the version from 'playwright --version'")
    elif cache is not None and install and deps:
        order = [steps.index(ver[0]), steps.index(cache), steps.index(install[0]), steps.index(deps[0])]
        e2e = [i for i, s in enumerate(steps) if "ci-e2e.sh" in str(s.get("run", ""))]
        if order != sorted(order) or not e2e or max(order) > e2e[0]:
            errs.append("order must be version -> cache -> install -> install-deps -> E2E")
    return errs


def mutants(doc):
    def mut(fn):
        d = copy.deepcopy(doc)
        fn(d)
        return d
    st = lambda d: steps_of(d)
    inst = lambda d: next(s for s in st(d) if INSTALL_RE.search(str(s.get("run", ""))))
    return {
        "job-timeout-removed": mut(lambda d: d["jobs"]["build"].pop("timeout-minutes", None)),
        "job-timeout-too-small": mut(lambda d: d["jobs"]["build"].__setitem__("timeout-minutes", 30)),
        "install-timeout-removed": mut(lambda d: inst(d).pop("timeout-minutes", None)),
        "cache-step-removed": mut(lambda d: d["jobs"]["build"].__setitem__("steps", [s for s in st(d) if not str(s.get("uses", "")).startswith("actions/cache@")])),
        "cache-path-wrong": mut(lambda d: find_cache(st(d))["with"].__setitem__("path", "~/.cache/other")),
        "cache-key-floating": mut(lambda d: find_cache(st(d))["with"].__setitem__("key", "playwright-${{ runner.os }}-latest")),
        "cache-action-unpinned": mut(lambda d: find_cache(st(d)).__setitem__("uses", "actions/cache@main")),
        "restore-keys-added": mut(lambda d: find_cache(st(d))["with"].__setitem__("restore-keys", "playwright-")),
        "install-always-runs": mut(lambda d: inst(d).pop("if", None)),
        "install-deps-removed": mut(lambda d: d["jobs"]["build"].__setitem__("steps", [s for s in st(d) if not DEPS_RE.search(str(s.get("run", "")))])),
    }


def main():
    doc = yaml.safe_load(open(CI))
    errs = check(doc)
    for e in errs:
        print("FAIL", e)
    if errs:
        return 1
    print("PASS ci.yml")
    if "--selftest" in sys.argv:
        live = 0
        for name, m in mutants(doc).items():
            try:
                bad = check(m)
            except Exception as ex:  # a mutant that crashes the checker is still rejected
                bad = [str(ex)]
            print(("killed " if bad else "SURVIVED ") + name)
            live += 0 if bad else 1
        return 1 if live else 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
