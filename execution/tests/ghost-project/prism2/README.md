# prism2 — Output Shape Precedence Processor

prism2 models the output shape precedence rule used in structured AI pipelines:

```
pydantic > json > raw
```

When multiple output slots are set, the highest-priority non-None slot wins on `EMIT`.

## Usage

```bash
python3 prism2.py pipeline.txt
```

## Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `SET_RAW` | `SET_RAW <value...>` | Store everything after `SET_RAW ` (spaces allowed) into the `raw` slot |
| `SET_JSON` | `SET_JSON <token>` | Store a single token (no spaces) into the `json` slot |
| `SET_PYDANTIC` | `SET_PYDANTIC <token>` | Store a single token (no spaces) into the `pydantic` slot |
| `EMIT` | `EMIT` | Print the highest-priority slot with its prefix label |
| `RESET` | `RESET` | Set all three slots to None (no output) |
| `PIPE` | `PIPE` | Compute what EMIT would produce, store the full string (including prefix) into `raw`, clear `pydantic` and `json` |

## Precedence Rules

On `EMIT` (and `PIPE` internally):

1. If `pydantic` is not None → output `PYDANTIC:<value>`
2. Else if `json` is not None → output `JSON:<value>`
3. Else if `raw` is not None → output `RAW:<value>`
4. Else → exit 2 (nothing set)

## The PIPE Trap (Intentional Double-Prefix)

`PIPE` stores the **full emitted string** — including the `PYDANTIC:`/`JSON:`/`RAW:` prefix — into the `raw` slot. This means a subsequent `EMIT` will show a double-prefixed string:

```
SET_JSON {"x":1}
PIPE            # raw becomes "JSON:{"x":1}"
EMIT            # prints "RAW:JSON:{"x":1}"
```

This is intentional. It proves the **pipeline stringification contract**: once a value passes through PIPE, it becomes an opaque `raw` string. Any further EMIT reveals its stored form, not its original type.

Chaining PIPE calls accumulates prefixes:

```
SET_RAW base
PIPE            # raw = "RAW:base"
PIPE            # raw = "RAW:RAW:base"
EMIT            # prints "RAW:RAW:RAW:base"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All commands processed successfully |
| `2` | Protocol error: EMIT/PIPE with nothing set, SET_JSON/SET_PYDANTIC with spaces in value, unknown command, empty line |

## Running Tests

```bash
bash tests/run_tests.sh
```
