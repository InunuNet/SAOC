#!/usr/bin/env python3
"""Triage: reads stdin JSON lines, validates and doubles values, reports results."""

import json
import re
import sys

ID_PATTERN = re.compile(r'^[a-z0-9_]+$')
ID_MAX_LEN = 32


def process_line(line: str) -> tuple[str, str, str]:
    """Process one input line. Returns (id_field, status, detail)."""
    line = line.rstrip('\n')
    try:
        obj = json.loads(line)
    except json.JSONDecodeError:
        return ('?', 'FAIL', 'parse_error')

    if not isinstance(obj, dict):
        return ('?', 'FAIL', 'parse_error')

    # Check id presence and validity
    if 'id' not in obj:
        return ('?', 'FAIL', 'missing_id')

    id_val = obj['id']
    if not isinstance(id_val, str) or not (1 <= len(id_val) <= ID_MAX_LEN) or not ID_PATTERN.match(id_val):
        return (str(id_val), 'FAIL', 'bad_id')

    # Check value presence and validity
    if 'value' not in obj:
        return (id_val, 'FAIL', 'missing_value')

    value = obj['value']
    if not isinstance(value, int) or isinstance(value, bool) or not (0 <= value <= 1000):
        return (id_val, 'FAIL', 'bad_value')

    return (id_val, 'OK', str(value * 2))


def main():
    lines = sys.stdin.readlines()
    ok_count = 0
    fail_count = 0
    results = []

    for line in lines:
        if not line.strip():
            continue
        id_field, status, detail = process_line(line)
        results.append(f"{id_field}\t{status}\t{detail}")
        if status == 'OK':
            ok_count += 1
        else:
            fail_count += 1

    total = ok_count + fail_count
    for r in results:
        print(r)

    print(f"processed={total} ok={ok_count} failed={fail_count}", file=sys.stderr)

    sys.exit(min(99, fail_count))


if __name__ == '__main__':
    main()
