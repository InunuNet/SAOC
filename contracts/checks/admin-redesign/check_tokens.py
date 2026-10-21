#!/usr/bin/env python3
"""Fail if admin-redesign files introduce a hex colour not in globals.css or the design handoff."""
import re, sys, pathlib
HEX = re.compile(r'#[0-9a-fA-F]{3,8}\b')
import subprocess
NEW_TOKEN_HEX = '#9b2c2c'  # Codi ruling: --color-error, the only new colour, defined once in globals.css @theme
base = subprocess.run(['git', 'show', 'origin/main:app/globals.css'], capture_output=True, text=True, check=True).stdout
allowed = {h.lower() for h in HEX.findall(base)}
allowed |= {h.lower() for h in HEX.findall(pathlib.Path('design/design_handoff_saoc/colors_and_type.css').read_text())}
cur = pathlib.Path('app/globals.css').read_text()
added = {h.lower() for h in HEX.findall(cur)} - allowed
if added != {NEW_TOKEN_HEX}:
    print(f'FAIL[tokens]: globals.css new hexes {sorted(added)}, want exactly {NEW_TOKEN_HEX}'); sys.exit(1)
if len(re.findall(NEW_TOKEN_HEX, cur, re.I)) != 1 or not re.search(r'--color-error:\s*' + NEW_TOKEN_HEX, cur, re.I):
    print('FAIL[tokens]: --color-error must be defined exactly once as --color-error in globals.css'); sys.exit(1)
roots = ['app/admin', 'app/admin-fixtures', 'components/admin', 'lib/admin-nav-config.ts', 'lib/studio-links.ts']
bad = []
for r in roots:
    rp = pathlib.Path(r)
    files = [rp] if rp.is_file() else list(rp.rglob('*')) if rp.exists() else []
    for f in files:
        if f.suffix not in {'.ts', '.tsx', '.css'}:
            continue
        for i, line in enumerate(f.read_text().splitlines(), 1):
            if line.lstrip().startswith(('//', '*', '/*')):
                continue
            for h in HEX.findall(line):
                if h.lower() not in allowed and not re.fullmatch(r'#[0-9]+', h):
                    bad.append(f'{f}:{i}: {h}')
if bad:
    print('FAIL[tokens]: hex outside tokens\n' + '\n'.join(bad)); sys.exit(1)
print('PASS[tokens]')
