#!/usr/bin/env python3
"""Bloom filter CLI — reads JSONL ops from stdin, emits JSONL results."""

import argparse
import hashlib
import json
import math
import sys


def _bit_positions(value: str, k: int, m: int) -> list:
    """Compute k bit positions for value using sha256 with seeds 0..k-1."""
    positions = []
    for i in range(k):
        digest = hashlib.sha256(f"{i}:{value}".encode()).hexdigest()
        positions.append(int(digest, 16) % m)
    return positions


def _bit_get(bits: bytearray, pos: int) -> bool:
    return bool(bits[pos >> 3] & (1 << (pos & 7)))


def _bit_set(bits: bytearray, pos: int) -> None:
    bits[pos >> 3] |= 1 << (pos & 7)


def run(m: int, k: int) -> None:
    """Process JSONL ops from stdin and write results to stdout."""
    bits = bytearray(math.ceil(m / 8))
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        record = json.loads(line)
        op = record["op"]
        value = record["value"]
        positions = _bit_positions(value, k, m)
        if op == "add":
            for pos in positions:
                _bit_set(bits, pos)
            result = "added"
        elif op == "query":
            result = "present" if all(_bit_get(bits, pos) for pos in positions) else "absent"
        else:
            continue
        sys.stdout.write(json.dumps({"op": op, "value": value, "result": result}) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bloom filter CLI")
    parser.add_argument("--m", type=int, required=True, help="Bit array size (integer >= 1)")
    parser.add_argument("--k", type=int, required=True, help="Number of hash functions (integer >= 1)")
    args = parser.parse_args()
    run(args.m, args.k)


if __name__ == "__main__":
    main()
