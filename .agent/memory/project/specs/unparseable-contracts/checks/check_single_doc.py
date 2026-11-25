#!/usr/bin/env python3
"""check_single_doc.py -- every named file must be exactly ONE YAML document and load with safe_load.

A heredoc containing `---` inside an unindented block splits a contract into several documents;
unquoted `: ` inside a scalar breaks the mapping. Usage: python3 check_single_doc.py FILE...
"""
import sys

import yaml

problems = []
for path in sys.argv[1:]:
    try:
        docs = list(yaml.safe_load_all(open(path, encoding="utf-8")))
    except yaml.YAMLError as exc:
        problems.append(f"{path}: {str(exc).splitlines()[0]} (line {getattr(getattr(exc, 'problem_mark', None), 'line', -1) + 1})")
        continue
    if len(docs) != 1 or not isinstance(docs[0], dict):
        problems.append(f"{path}: expected 1 mapping document, got {len(docs)}")
if problems:
    for p in problems:
        print(f"FAIL: {p}")
    sys.exit(1)
print(f"OK: {len(sys.argv) - 1} file(s) parse as a single document")
