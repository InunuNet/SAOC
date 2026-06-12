# Scope — Nested State Shared-Key Reducer

A command-driven processor that manages two named state scopes (`inner` and `outer`) with configurable per-key reducers. Keys can exist in one or both scopes. The CROSS command is where the interesting work happens.

## The Silent-Drop Trap

The most important thing to understand: **`unregistered` is not an error state — it is a deliberate filter.**

When a key is registered in outer with reducer `unregistered`, a CROSS operation will:
- Still update the inner state (using the inner reducer).
- Silently discard the value at the outer boundary — outer state stays `<unset>`.
- Emit `DROPPED <KEY>` to signal this happened.

A direct `OUTER_UPDATE` through an `unregistered` reducer is a hard error (exit 2), because that path has no ambiguity — the caller explicitly targeted the outer scope.

## Reducer Semantics

| Reducer | Behaviour |
|---------|-----------|
| `overwrite` | Last value wins. New value replaces current. |
| `append` | Join with comma: `prior,new`. First value has no leading comma. |
| `unregistered` | Blocked on direct OUTER_UPDATE. Silently drops on CROSS. |

Reducers are per (key, scope) — the same key can have different reducers in inner and outer.

## CLI

```
python3 scope.py commands.txt
```

`commands.txt` is a file of tab-separated commands, one per line. Blank lines are ignored.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All commands processed successfully |
| 2 | Malformed input: duplicate register, unknown key, blocked reducer, bad argument count |

## Commands Quick Reference

| Command | Args | Notes |
|---------|------|-------|
| `REGISTER` | `KEY SCOPE REDUCER` | SCOPE ∈ {inner,outer}; REDUCER ∈ {append,overwrite,unregistered}; duplicate (KEY,SCOPE) → exit 2 |
| `INNER_UPDATE` | `KEY VALUE` | Buffers update for CROSS; key must be registered in inner |
| `OUTER_UPDATE` | `KEY VALUE` | Applies immediately to outer; unregistered reducer → exit 2 |
| `CROSS` | — | Flushes pending inner buffer; see SPEC.md for all 3 branches |
| `GET_INNER` | `KEY` | Prints `INNER KEY: value` or `INNER KEY: <unset>`; key must be in inner |
| `GET_OUTER` | `KEY` | Prints `OUTER KEY: value` or `OUTER KEY: <unset>`; key must be in outer (inner-only key → exit 2) |

## Running Tests

```bash
bash execution/tests/ghost-project/scope/tests/run_tests.sh
```
