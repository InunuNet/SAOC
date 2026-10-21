"""Deterministic checks for the claude-md-ozow contract. Usage: verify_claude_md_ozow.py <mode>"""
import difflib
import subprocess
import sys

PATH = "CLAUDE.md"
ALLOWED_OLD_LINES = {24, 55, 72}  # 1-based lines in HEAD that may be replaced
MAX_CHANGED = 10


def head_lines():
    out = subprocess.run(["git", "show", "HEAD:" + PATH], capture_output=True, check=True).stdout
    return out.decode("utf-8").split("\n")


def work_lines():
    with open(PATH, encoding="utf-8") as fh:
        return fh.read().split("\n")


def vso(lines):
    hits = [ln for ln in lines if ln.startswith("| `vendorStandOrders`")]
    return hits


def main(mode):
    old, new = head_lines(), work_lines()
    if mode == "vso":
        a, b = vso(old), vso(new)
        return len(a) == 1 and a == b
    if mode == "diff":
        changed = 0
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, old, new, autojunk=False).get_opcodes():
            if tag == "equal":
                continue
            changed += max(i2 - i1, j2 - j1)
            if tag == "insert":
                if not (71 <= i1 <= 73):
                    print("insert outside lib tree at old line", i1 + 1)
                    return False
                continue
            for n in range(i1 + 1, i2 + 1):
                if n not in ALLOWED_OLD_LINES:
                    print("unexpected change at old line", n)
                    return False
        return changed <= MAX_CHANGED
    if mode == "payments":
        rows = [ln for ln in new if ln.startswith("| Payments |")]
        r = rows[0] if len(rows) == 1 else ""
        need = ["Ozow", "lib/ozow.ts", "lib/payments/", "docs/payment-gateway-selection.md", "PayFast"]
        return bool(r) and all(s in r for s in need) and "PayFast (sandbox)" not in r
    if mode == "tickets":
        rows = [ln for ln in new if "├── tickets/" in ln]
        return len(rows) == 1 and "Ozow" in rows[0]
    if mode == "lib":
        oz = [ln for ln in new if ln.lstrip("├└─│ ").startswith("ozow.ts")]
        pf = [ln for ln in new if ln.lstrip("├└─│ ").startswith("payfast.ts")]
        return len(oz) == 1 and len(pf) == 1 and "retained" in pf[0]
    return False


sys.exit(0 if main(sys.argv[1]) else 1)
