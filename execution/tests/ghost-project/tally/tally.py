#!/usr/bin/env python3
"""Tally: CSV aggregator with banker's rounding."""

import csv
import json
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_EVEN, InvalidOperation


def main():
    if len(sys.argv) < 2:
        sys.exit(1)

    path = sys.argv[1]
    try:
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            if reader.fieldnames is None or "id" not in reader.fieldnames or "amount" not in reader.fieldnames:
                sys.exit(1)

            sums = defaultdict(Decimal)
            for row in reader:
                try:
                    sums[row["id"]] += Decimal(row["amount"])
                except (InvalidOperation, KeyError):
                    sys.exit(1)
    except (OSError, IOError):
        sys.exit(1)

    two_dp = Decimal("0.01")
    four_dp = Decimal("0.0001")

    groups = []
    grand_total = Decimal("0")

    for gid in sorted(sums.keys()):
        raw = sums[gid]
        raw_total = raw.quantize(four_dp, rounding=ROUND_HALF_EVEN)
        rounded_total = raw.quantize(two_dp, rounding=ROUND_HALF_EVEN)
        grand_total += rounded_total
        groups.append({
            "id": gid,
            "raw_total": str(raw_total),
            "rounded_total": str(rounded_total),
        })

    grand_total = grand_total.quantize(two_dp, rounding=ROUND_HALF_EVEN)

    result = {
        "grand_total": str(grand_total),
        "groups": groups,
    }

    print(json.dumps(result, sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
