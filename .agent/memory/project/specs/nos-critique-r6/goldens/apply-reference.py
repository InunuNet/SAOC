#!/usr/bin/env python3
"""Reference implementation of R65 for nos-critique-r6, as a mechanical transform (golden for @dev, and the
green proof for check-static.mjs). Usage: apply-reference.py <worktree-root>

  nos-theme.css   line-height 1.65 -> 1.55 and --fs-body 1.0625rem -> 1rem (the only two cleared lines)
  presenters.css  1.65 -> 1.55, --pc-bio-lh 1.68 -> 1.55, drop the stale 1.0625rem fallback and the 17px comment
  *.tsx in scope  1. sans text-[17px]                          -> text-[length:var(--fs-body,1rem)]
                  2. sans 13-15px PROSE (not allowlisted,
                     not uppercase / font-mono)                -> text-[length:var(--fs-body,1rem)]
                  3. every non-serif body-role line            -> exactly one leading-[1.55]
"""
import json, os, re, sys

root = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
allow = json.load(open(os.path.join(here, 'small-text-allowlist.json')))
NS = 'app/(marketing)/national-show'
VAR = 'text-[length:var(--fs-body,1rem)]'
LEAD = re.compile(r'(?<![\w-])leading-(?:\[[^\]]+\]|none|tight|snug|normal|relaxed|loose|\d+)(?![\w-])')

def rw(rel, fn):
    p = os.path.join(root, rel)
    s = open(p).read()
    n = fn(s)
    if n != s:
        open(p, 'w').write(n)

rw(f'{NS}/nos-theme.css', lambda s: s.replace('\n  line-height: 1.65;\n', '\n  line-height: 1.55;\n').replace('\n  --fs-body: 1.0625rem;\n', '\n  --fs-body: 1rem;\n'))
rw(f'{NS}/presenters.css', lambda s: s.replace('1.65', '1.55').replace('1.68', '1.55').replace('1.0625rem', '1rem').replace('17px', '16px'))

EXCL = [f'{NS}/tickets/', f'{NS}/vendors/apply/', f'{NS}/vendors/register/', f'{NS}/vendors/payment/', f'{NS}/vendors/photos/']
files = []
for base in ('components/show', 'components/nos', NS):
    for d, _, fs in os.walk(os.path.join(root, base)):
        for f in fs:
            if f.endswith('.tsx'):
                files.append(os.path.relpath(os.path.join(d, f), root))
files += ['components/vendors/VendorIntro.tsx', 'components/vendors/VendorGrid.tsx', 'components/vendors/VendorEmptyState.tsx']
files = [f for f in files if f != 'components/show/nos/ShowContentState.tsx' and not any(f.startswith(e) for e in EXCL)]

def line_fn(rel):
    ents = [e['contains'] for e in allow['entries'] if e['file'] == rel]
    def one(line):
        if 'font-serif' in line:
            return line
        if re.search(r'\btext-\[17px\]', line):
            line = line.replace('text-[17px]', VAR)
        elif re.search(r'\btext-\[1[2-5](?:\.\d+)?px\]', line) and not re.search(r'\buppercase\b|\bfont-mono\b', line) and not any(c in line for c in ents):
            line = re.sub(r'\btext-\[1[2-5](?:\.\d+)?px\]', VAR, line)
        if re.search(r'\btext-\[16px\]|' + re.escape(VAR), line):
            line = LEAD.sub('', line)
            line = line.replace(VAR, VAR + ' leading-[1.55]', 1) if VAR in line else line.replace('text-[16px]', 'text-[16px] leading-[1.55]', 1)
            line = re.sub(r'(className=")\s+', r'\1', line)
            line = re.sub(r'(className="[^"]*?)\s+"', r'\1"', line)
            line = re.sub(r'(?<=\S)  +(?=\S)', ' ', line)
        return line
        if re.search(r'\btext-\[17px\]', line):
            line = line.replace('text-[17px]', VAR)
        elif re.search(r'\btext-\[1[2-5](?:\.\d+)?px\]', line) and not re.search(r'\buppercase\b|\bfont-mono\b', line) and not any(c in line for c in ents):
            line = re.sub(r'\btext-\[1[2-5](?:\.\d+)?px\]', VAR, line)
        if re.search(r'\btext-\[16px\]|' + re.escape(VAR), line):
            line = LEAD.sub('', line)
            line = line.replace(VAR, VAR + ' leading-[1.55]', 1) if VAR in line else line.replace('text-[16px]', 'text-[16px] leading-[1.55]', 1)
            line = re.sub(r'  +', ' ', line.replace(' "', '"').replace('" ', '"') if False else line)
            line = re.sub(r'(className=")\s+', r'\1', line)
            line = re.sub(r'\s+"', '"', line)
        return line
    return lambda s: '\n'.join(one(l) for l in s.split('\n'))

for rel in files:
    rw(rel, line_fn(rel))
print(f'reference applied to {len(files)} files')
