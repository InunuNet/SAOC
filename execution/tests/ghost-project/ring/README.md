# ghost-ring — Circular Buffer CLI

A command-line circular (ring) buffer that processes a stream of JSONL operations
(`push` / `pop` / `peek`) against a fixed-capacity buffer and emits one JSONL result
line per operation. Overflow behavior is selectable at startup.

## Usage

```
python3 ring.py --capacity <int> --overflow <OVERWRITE|REJECT> < ops.jsonl
```

### Arguments

| Flag | Required | Description |
|------|----------|-------------|
| `--capacity INT` | Yes | Maximum number of live elements. Must be ≥ 1. |
| `--overflow MODE` | Yes | `OVERWRITE` evicts the oldest element on full; `REJECT` refuses the write. |

### Input (stdin)

One JSON object per line:

| Op | Shape |
|----|-------|
| push | `{"op": "push", "value": "<str>"}` |
| pop | `{"op": "pop"}` |
| peek | `{"op": "peek"}` |

### Output (stdout)

One JSON result line per input line, in order:

```
{"op": "<op>", "result": "<str>", "size": <int>}
```

Key order is significant: `op`, then `result`, then `size`. Python's default
`json.dumps` separators apply (`", "` between pairs, `": "` between key and value).

Result values:

| Situation | result |
|-----------|--------|
| push succeeds (not full) | `"ok"` |
| push on full buffer, OVERWRITE | `"ok"` |
| push on full buffer, REJECT | `"full"` |
| pop on non-empty buffer | the removed value |
| pop on empty buffer | `"empty"` |
| peek on non-empty buffer | the head value (non-destructive) |
| peek on empty buffer | `"empty"` |

## Exit Codes

| Condition | Exit |
|-----------|------|
| All ops processed, no pop-on-empty occurred | `0` |
| At least one pop on an empty buffer occurred | `1` |
| peek-empty does **not** affect the exit code | — |

The exit code is determined **after** the entire stream is consumed, never mid-stream.

## Worked Example — OVERWRITE Behavior

Buffer capacity 3 with `OVERWRITE` overflow:

```
$ cat ops.jsonl
{"op": "push", "value": "a"}
{"op": "push", "value": "b"}
{"op": "push", "value": "c"}
{"op": "push", "value": "d"}
{"op": "pop"}
{"op": "peek"}

$ python3 ring.py --capacity 3 --overflow OVERWRITE < ops.jsonl
{"op": "push", "result": "ok", "size": 1}
{"op": "push", "result": "ok", "size": 2}
{"op": "push", "result": "ok", "size": 3}
{"op": "push", "result": "ok", "size": 3}
{"op": "pop", "result": "b", "size": 2}
{"op": "peek", "result": "c", "size": 2}
```

After pushing `d` into a full buffer, the **oldest** element (`a`) is evicted.
The buffer holds `[b, c, d]`. The first `pop` returns `b` (oldest remaining), and
`peek` sees `c` — the new head. Exit code is `0` (no pop-on-empty).

## Testing

```bash
bash tests/run_tests.sh
# Expected: 3 passed, 0 failed
```

The harness runs three named fixture suites (`overwrite`, `reject`, `peek`), each
comparing stdout line-by-line against a golden file and checking the expected exit
code. Exit `0` means all suites passed; exit `1` means at least one failed.
