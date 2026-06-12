# prism2 SPEC — Output Shape Precedence

## Overview

prism2 processes a text pipeline file line-by-line. It maintains three named
slots (`pydantic`, `json`, `raw`), all starting as None. Commands SET, EMIT,
RESET, and PIPE manipulate these slots according to a strict precedence rule.

---

## Commands

### SET_RAW `<value>`
- Syntax: `SET_RAW ` followed by everything to end-of-line
- Value MAY contain spaces
- Stores into `raw` slot

### SET_JSON `<token>`
- Syntax: `SET_JSON ` followed by exactly one token
- Token MUST NOT contain spaces → exit 2 if it does
- Stores into `json` slot

### SET_PYDANTIC `<token>`
- Syntax: `SET_PYDANTIC ` followed by exactly one token
- Token MUST NOT contain spaces → exit 2 if it does
- Stores into `pydantic` slot

### EMIT
- No arguments
- Applies precedence (see below) to determine output
- If all slots are None → exit 2
- Prints one line to stdout

### RESET
- No arguments
- Sets all three slots to None
- No output

### PIPE
- No arguments
- Internally applies the same precedence as EMIT
- If all slots are None → exit 2
- Stores the FULL emitted string (including prefix label) into `raw`
- Sets `pydantic` and `json` to None
- No output to stdout

---

## Precedence Rule

Applied by both EMIT and PIPE:

```
if pydantic is not None:
    result = "PYDANTIC:" + pydantic
elif json is not None:
    result = "JSON:" + json
elif raw is not None:
    result = "RAW:" + raw
else:
    exit 2
```

---

## All 8 Slot Combinations at EMIT

| pydantic | json | raw | Output |
|----------|------|-----|--------|
| None | None | None | exit 2 |
| None | None | set | `RAW:<raw>` |
| None | set | None | `JSON:<json>` |
| None | set | set | `JSON:<json>` |
| set | None | None | `PYDANTIC:<pydantic>` |
| set | None | set | `PYDANTIC:<pydantic>` |
| set | set | None | `PYDANTIC:<pydantic>` |
| set | set | set | `PYDANTIC:<pydantic>` |

---

## PIPE Contract

PIPE stringifies the current winning slot, including its prefix, and stores it
as a raw string. This degrades the type annotation: the value is no longer
typed as pydantic or json — it is an opaque raw string.

**Consequence:** Chained PIPEs accumulate prefix labels:

```
SET_PYDANTIC {"p":1}    # pydantic='{"p":1}'
PIPE                     # raw='PYDANTIC:{"p":1}', pydantic=None, json=None
EMIT                     # → RAW:PYDANTIC:{"p":1}
```

```
SET_RAW base
PIPE                     # raw='RAW:base'
PIPE                     # raw='RAW:RAW:base'
EMIT                     # → RAW:RAW:RAW:base
```

This behavior is intentional. It encodes the pipeline's stringification history
in the value itself, allowing downstream consumers to detect how many times a
value has been re-typed.

---

## Exit Codes

| Code | Condition |
|------|-----------|
| `0` | All lines processed without error |
| `2` | Protocol error (any of the following): EMIT with nothing set; PIPE with nothing set; SET_JSON value contains spaces; SET_PYDANTIC value contains spaces; unknown command; empty line |

---

## File Format

- One command per line
- Lines are stripped of trailing `\r\n`
- Empty lines (after stripping) → exit 2
- No comments supported
- No continuation lines — each line is a complete command
