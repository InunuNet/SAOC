"""Circular buffer CLI — processes JSONL ops (push/pop/peek) against a fixed-capacity ring."""

import argparse
import json
import sys

OVERFLOW_OVERWRITE = "OVERWRITE"
OVERFLOW_REJECT = "REJECT"
VALID_OVERFLOW = {OVERFLOW_OVERWRITE, OVERFLOW_REJECT}


def parse_args():
    parser = argparse.ArgumentParser(description="Circular buffer JSONL processor")
    parser.add_argument(
        "--capacity",
        type=int,
        required=True,
        help="Maximum number of live elements (>= 1)",
    )
    parser.add_argument(
        "--overflow",
        choices=list(VALID_OVERFLOW),
        required=True,
        help="Overflow behavior: OVERWRITE (evict oldest) or REJECT (refuse write)",
    )
    args = parser.parse_args()
    if args.capacity < 1:
        parser.error("--capacity must be >= 1")
    return args


def process_ops(capacity, overflow, lines):
    buf = [None] * capacity
    head = 0
    size = 0
    pop_empty_seen = False
    results = []

    for line in lines:
        line = line.strip()
        if not line:
            continue
        op_obj = json.loads(line)
        op = op_obj["op"]

        if op == "push":
            value = op_obj["value"]
            if size < capacity:
                buf[(head + size) % capacity] = value
                size += 1
                result = "ok"
            elif overflow == OVERFLOW_OVERWRITE:
                buf[(head + size) % capacity] = value
                head = (head + 1) % capacity
                result = "ok"
                # size stays at capacity
            else:  # REJECT
                result = "full"
                # no state change

        elif op == "pop":
            if size > 0:
                result = buf[head]
                head = (head + 1) % capacity
                size -= 1
            else:
                result = "empty"
                pop_empty_seen = True
                # size stays 0

        elif op == "peek":
            if size > 0:
                result = buf[head]
            else:
                result = "empty"
                # peek-empty is NOT an error; exit code unaffected

        else:
            raise ValueError(f"Unknown op: {op!r}")

        results.append({"op": op, "result": result, "size": size})

    return results, pop_empty_seen


def main():
    args = parse_args()
    lines = sys.stdin.readlines()
    results, pop_empty_seen = process_ops(args.capacity, args.overflow, lines)
    for record in results:
        print(json.dumps(record))
    sys.exit(1 if pop_empty_seen else 0)


if __name__ == "__main__":
    main()
