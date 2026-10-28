#!/usr/bin/env python3
"""Meta-assertion: no contract runs a live-write check in the default gate.

Scans every contract (contracts/**/*.yaml and .agent/memory/project/specs/**/contract*.yaml) and
fails if an assertion in `assertions.checks` (or the legacy `phases:` dict) executes a script that
writes to production (Sanity dataset, Firestore, Firebase Auth, a deployed host, a payment gateway,
Resend) unless one of these holds:
  - the writer is registered in the registry as a safe class (fake / credential-scrubbed local
    server / static false positive / read-only probe) and its evidence regex still matches the file;
  - the writer is registered MODAL and the command carries one of its safe-mode arguments;
  - the command sets SAOC_FIXTURE_REPLAY=1 and the script itself references SAOC_FIXTURE_REPLAY.
Anything else is a violation. The sanctioned exit for a real writer is a top-level `manual_only:`
block in the contract, which contract.py never loads into a phase (execution/contract.py:70-90,
normalize_contract reads only assertions/phases); each entry needs id, command and an inline
reason of at least MIN_REASON characters.

A script with write signals that is not in the registry at all is also a violation ("unclassified"),
so a new writer cannot slip in unclassified.

Static: reads YAML and script text only, never executes a contract command, needs no secrets or network.
Runs in CI (.github/workflows/ci.yml job live-write-guard) and as contract-live-write-audit A1.

Usage: verify_no_ungated_writers.py [--root DIR] [--registry FILE] [--summary]
Exit 0 clean, 1 violations, 2 usage/parse error.
"""
import argparse
import glob
import json
import os
import re
import sys

import yaml

MIN_REASON = 40
REAL_CLASSES = {"REAL_SANITY", "REAL_FIRESTORE", "REAL_AUTH", "REAL_DEPLOYED"}
SAFE_CLASSES = {"SANDBOX_SCRUBBED", "FAKE", "STATIC_FP", "READONLY_PROBE", "MODAL"}

SCRIPT_PATH = (
    r"((?:scripts|contracts/checks|contracts/golden|execution|\.agent/memory/project/specs|tests|e2e)"
    r"/[A-Za-z0-9_./\-]*?[A-Za-z0-9_\-]+\.(?:ts|mts|mjs|js|py|sh|cjs))"
)
INTERP = (
    r"(?:^|[;&|(\s`$])(?:node|tsx|python3?|bash|sh|zsh|bun|deno|npx|pnpm(?:\s+exec)?|pnpm\s+dlx)"
    r"(?:\s+(?:-{1,2}[A-Za-z0-9_=\-./:]+|[A-Za-z0-9_./\-]+/esm|tsx/esm|tsx))*\s+['\"]?"
)
EXEC_RX = re.compile(INTERP + SCRIPT_PATH)
EXEC_DOT_RX = re.compile(r"(?:^|[;&|(\s`])\./" + SCRIPT_PATH)

MUT = re.compile(
    r"createOrReplace|createIfNotExists|\.patch\(|client\.create\(|\.transaction\(\)|data/mutate|\.mutate\(|"
    r"setIfMissing|setFieldsAndPublish|setFieldAndPublish|commitAndCaptureRev|restoreGuarded|\bmutate\(|"
    r"signUpProbeAccount|signUpViaRestApi|createPaidTicketFixture|runDoorSeedCli|postCheckout|postCheckin|"
    r"postSession|withCleanup|sentinelEmail|callRevalidate|action-publish|runScript\("
)
FSW = re.compile(r"\.(set|add|update|delete)\(\s*[\{a-zA-Z_]|runTransaction\(|\.batch\(\)|\.commit\(\)")
POST = re.compile(
    r"method:\s*['\"](POST|PUT|PATCH|DELETE)['\"]|-X\s*(POST|PUT|PATCH|DELETE)|requests\.post|urlopen\(.*data"
)
SPAWN = re.compile(
    r"(?:node|npx tsx|tsx)[^\n]{0,40}(?:seed|migrate|fix|unpublish|swap)-[a-z0-9\-]+\.ts|"
    r"execFile\([^)]*seed-|execSync\([^)]*seed-"
)
FAKE = re.compile(r"class Fake|makeFakeDb|fakeDb|FakeFirestore|demo-project|in-memory")
DB = re.compile(r"initAdmin\(|getFirestore\(|from ['\"][^'\"]*lib/firebase-admin")
INLINE_RUNNER = re.compile(r"node\s+(-e|--eval)|tsx\s+-e|python3?\s+-c|\bcurl\b")
INLINE_WRITE = re.compile(
    r"createOrReplace|createIfNotExists|\.patch\(|curl[^|;&]*(-X\s*(POST|PUT|PATCH|DELETE)|--data|-d\s)"
)
LOCAL_ONLY = re.compile(r"(127\.0\.0\.1|localhost)")
FIXTURE_ENV = "SAOC_FIXTURE_REPLAY"
# A safe-class evidence regex that matches any of these proves nothing about the script it names.
TRIVIAL_SAMPLES = ("", "x", "console.log(1)\n", "#!/usr/bin/env bash\necho ok\n")


def contract_files(root):
    pats = [root + "/contracts/**/*.yaml", root + "/.agent/memory/project/specs/**/contract*.yaml"]
    seen = set()
    for p in pats:
        for f in glob.glob(p, recursive=True):
            rel = "/" + os.path.relpath(f, root)
            if "/contracts/checks/" in rel or "/contracts/golden/" in rel or "/goldens/" in rel:
                continue
            seen.add(f)
    return sorted(seen)


def command_of(check):
    if not isinstance(check, dict):
        return ""
    v = check.get("verify")
    if isinstance(v, dict):
        return str(v.get("cmd") or "")
    return str(check.get("command") or check.get("cmd") or (v if isinstance(v, str) else "") or "")


def checks_of(c):
    a = c.get("assertions")
    out = []
    if isinstance(a, dict):
        out += a.get("checks") or []
    elif isinstance(a, list):
        out += a
    ph = c.get("phases")
    if isinstance(ph, dict):
        for items in ph.values():
            out += items or []
    return [x for x in out if isinstance(x, dict)]


def own_signals(path):
    try:
        lines = open(path, errors="ignore").read().splitlines()
    except OSError:
        return {}
    code = [(n + 1, l) for n, l in enumerate(lines) if not l.strip().startswith(("//", "#", "*", "/*"))]
    txt = "\n".join(l for _, l in code)
    hits = {}
    for key, rx in (("MUT", MUT), ("FSW", FSW), ("POST", POST), ("SPAWN", SPAWN)):
        ls = [n for n, l in code if rx.search(l)]
        if ls:
            hits[key] = ls[:4]
    if "FSW" in hits and (not DB.search(txt) or FAKE.search(txt)):
        del hits["FSW"]
    return hits


def scan(root, registry):
    violations, stats = [], {"contracts": 0, "assertions": 0, "executing": 0, "safe": 0, "manual_only": 0}
    for f in contract_files(root):
        try:
            c = yaml.safe_load(open(f))
        except Exception as e:  # unparseable contracts are reported by verify_all_contracts_parse
            print(f"SKIP-UNPARSEABLE {os.path.relpath(f, root)}: {type(e).__name__}", file=sys.stderr)
            continue
        if not isinstance(c, dict) or c.get("schema") != "athanor.contract/v1":
            continue
        stats["contracts"] += 1
        rel = os.path.relpath(f, root)
        checks = checks_of(c)
        ids = {str(x.get("id")) for x in checks}
        for m in c.get("manual_only") or []:
            stats["manual_only"] += 1
            mid = str(m.get("id")) if isinstance(m, dict) else "?"
            if not isinstance(m, dict) or not m.get("command") or not m.get("id"):
                violations.append((rel, mid, "-", "manual_only entry needs id and command"))
            elif len(str(m.get("reason") or "").strip()) < MIN_REASON:
                violations.append((rel, mid, "-", f"manual_only reason shorter than {MIN_REASON} chars"))
            elif mid in ids:
                violations.append((rel, mid, "-", "manual_only id also present in assertions.checks"))
        phases = c.get("phases")
        if isinstance(phases, list):
            for ph in phases:
                for ref in (ph.get("assertions") or []) if isinstance(ph, dict) else []:
                    if str(ref) not in ids:
                        violations.append((rel, str(ref), "-", "phases list references an assertion id that is not in the checks"))
        for ch in checks:
            stats["assertions"] += 1
            cid = str(ch.get("id"))
            cmd = command_of(ch)
            scripts = set(EXEC_RX.findall(cmd)) | set(EXEC_DOT_RX.findall(cmd))
            if INLINE_RUNNER.search(cmd) and INLINE_WRITE.search(cmd) and not scripts and not LOCAL_ONLY.search(cmd):
                if FIXTURE_ENV + "=1" not in cmd:
                    violations.append((rel, cid, "<inline>", "inline write-capable command in default gate"))
            for s in sorted(scripts):
                sp = os.path.join(root, s)
                if not os.path.isfile(sp):
                    continue
                stats["executing"] += 1
                entry = registry.get(s)
                if entry is None:
                    sig = own_signals(sp)
                    if not sig:
                        continue
                    if FIXTURE_ENV + "=1" in cmd and FIXTURE_ENV in open(sp, errors="ignore").read():
                        stats["safe"] += 1
                        continue
                    violations.append((rel, cid, s, f"unclassified writer signals {sig}; add to registry or manual_only"))
                    continue
                cls = entry.get("class")
                if cls in REAL_CLASSES:
                    if FIXTURE_ENV + "=1" in cmd and FIXTURE_ENV in open(sp, errors="ignore").read():
                        stats["safe"] += 1
                        continue
                    violations.append((rel, cid, s, f"{cls} writer runs in default gate; move to manual_only with a reason"))
                elif cls == "MODAL":
                    if not any(a in cmd for a in entry.get("safe_args", [])):
                        violations.append((rel, cid, s, f"MODAL writer without a safe-mode argument {entry.get('safe_args')}"))
                    else:
                        stats["safe"] += 1
                elif cls in SAFE_CLASSES:
                    rx = entry.get("match")
                    if not isinstance(rx, str) or not rx.strip():
                        violations.append((rel, cid, s, f"{cls} entry has no evidence `match` regex"))
                    elif any(re.search(rx, t) for t in TRIVIAL_SAMPLES):
                        violations.append((rel, cid, s, f"{cls} evidence /{rx}/ matches a trivial script; make it script-specific"))
                    elif not re.search(rx, open(sp, errors="ignore").read()):
                        violations.append((rel, cid, s, f"{cls} evidence /{rx}/ no longer matches the script"))
                    else:
                        stats["safe"] += 1
                else:
                    violations.append((rel, cid, s, f"registry class {cls!r} unknown"))
    return violations, stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".")
    ap.add_argument("--registry", default=None)
    ap.add_argument("--summary", action="store_true")
    a = ap.parse_args()
    root = os.path.abspath(a.root)
    reg_path = a.registry or os.path.join(os.path.dirname(os.path.abspath(__file__)), "writers-registry.json")
    try:
        registry = json.load(open(reg_path))["scripts"]
    except (OSError, ValueError, KeyError) as e:
        print(f"ERROR: cannot load registry {reg_path}: {type(e).__name__}", file=sys.stderr)
        return 2
    violations, stats = scan(root, registry)
    for rel, cid, s, why in violations:
        print(f"VIOLATION {rel}:{cid} {s} -- {why}")
    print(f"scanned {stats['contracts']} contracts, {stats['assertions']} assertions, "
          f"{stats['executing']} script executions, {stats['safe']} classified safe, "
          f"{stats['manual_only']} manual_only entries; violations={len(violations)}")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
