#!/usr/bin/env python3
"""Every hex literal in the given source file must be in goldens/token-allowlist.json.
usage: check_token_hexes.py <lib/ticket-design/tokens.ts>   exit 0 ok, 1 stray hex, 2 setup."""
import json, re, sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent.parent
allowed = {t["hex"].lower() for t in json.loads((HERE / "token-allowlist.json").read_text())["tokens"].values()}
if len(sys.argv) != 2 or not pathlib.Path(sys.argv[1]).is_file():
    print("usage: check_token_hexes.py <file>"); sys.exit(2)
found = {h.lower() for h in re.findall(r"#[0-9a-fA-F]{6}\b", pathlib.Path(sys.argv[1]).read_text())}
if not found: print("FAIL no hex literals found: the token table is missing"); sys.exit(1)
stray = sorted(found - allowed)
if stray: print("FAIL hex not in the approved token set:", ", ".join(stray)); sys.exit(1)
print("token hexes ok:", len(found))
