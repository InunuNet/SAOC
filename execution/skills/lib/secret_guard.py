#!/usr/bin/env python3
"""secret_guard.py — classify repo-relative paths as secret-looking or safe.

Pure classifier: no git access, no filesystem I/O beyond stdin/argv.

Usage:
    secret_guard.py --stdin           # read newline-separated paths from stdin
    secret_guard.py path1 path2 ...   # classify argv paths directly

Prints each matching (secret-looking) path to stdout, one per line.
Exit code: 1 if any secret-looking path is found, 0 otherwise.
"""

import re
import sys

ENV_ALLOWLIST = {
    ".env.enc",
    ".env.example",
    ".env.sample",
    ".env.template",
    ".env.dist",
}

KEY_BASENAMES = {"id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"}

SECRETS_DIR_RE = re.compile(r"(^|/)\.secrets/", re.IGNORECASE)
FIREBASE_ADMIN_RE = re.compile(r"(firebase-adminsdk|-adminsdk-).*\.json$", re.IGNORECASE)
KEY_EXT_RE = re.compile(r"\.(pem|p12|pfx|p8|jks|key)$", re.IGNORECASE)


def is_secret(path: str) -> bool:
    """Return True if `path` looks like a secret file."""
    base = path.rsplit("/", 1)[-1]
    base_lower = base.lower()

    if SECRETS_DIR_RE.search(path):
        return True
    if FIREBASE_ADMIN_RE.search(base):
        return True
    if (base_lower == ".env" or base_lower.startswith(".env.")) and base_lower not in ENV_ALLOWLIST:
        return True
    if base_lower in KEY_BASENAMES or KEY_EXT_RE.search(base):
        return True
    return False


def read_paths() -> list:
    """Return the list of paths to classify, from --stdin or argv."""
    if "--stdin" in sys.argv:
        return [line.strip() for line in sys.stdin if line.strip()]
    return [arg for arg in sys.argv[1:] if arg != "--stdin"]


def main() -> int:
    paths = read_paths()
    matches = [p for p in paths if is_secret(p)]
    for path in matches:
        print(path)
    return 1 if matches else 0


if __name__ == "__main__":
    sys.exit(main())
