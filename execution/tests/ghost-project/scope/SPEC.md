# Scope — Specification

## State Model

Scope maintains two independent state stores:

- **inner state**: a key→value map for keys registered in the `inner` scope.
- **outer state**: a key→value map for keys registered in the `outer` scope.

A key may exist in both scopes simultaneously. When it does, each scope has its own reducer and its own current value — they are not the same slot.

All values start as `<unset>` (represented as `None` internally). There is no null/empty distinction — a key either has a string value or it is `<unset>`.

## Pending Buffer

`INNER_UPDATE` commands do not immediately modify inner state. They accumulate in a **pending buffer** (ordered list of `(key, value)` pairs) that is only applied during `CROSS`.

The pending buffer is cleared after every CROSS, regardless of how many entries it had (including zero).

## CROSS — Three Branches

For each pending update `(key, value)` in insertion order:

### Branch 1 — CROSSED (key in outer, outer reducer ∈ {append, overwrite})

The update crosses the boundary:
1. Apply `value` to **outer** state using **outer's reducer**.
2. Apply `value` to **inner** state using **inner's reducer**.
3. Emit: `CROSSED <key>=<value>`

### Branch 2 — DROPPED (key in outer, outer reducer = unregistered)

The outer boundary blocks the value silently:
1. Apply `value` to **inner** state using **inner's reducer** (inner is still updated).
2. Outer state is **not modified** — stays `<unset>` or at its current value.
3. Emit: `DROPPED <key>`

### Branch 3 — ISOLATED (key NOT in outer)

The key has no outer registration at all:
1. Apply `value` to **inner** state using **inner's reducer**.
2. Outer state is unaffected (the key does not exist there).
3. Emit: `ISOLATED <key>`

## Reducer Behavior

```
overwrite(current, new) = new
append(current, new) = current + "," + new  (if current is set)
                      = new                  (if current is <unset>)
unregistered           = error on OUTER_UPDATE; silent drop on CROSS
```

Each application of a reducer produces a new value that replaces the current one in the relevant state store.

## Command Semantics

### REGISTER KEY SCOPE REDUCER
- Valid SCOPE: `inner`, `outer`
- Valid REDUCER: `append`, `overwrite`, `unregistered`
- Registers (key, scope) with the given reducer.
- Initializes the state slot to `<unset>` if not already set.
- Duplicate (key, scope) → exit 2.

### INNER_UPDATE KEY VALUE
- KEY must be registered in inner → exit 2 if not.
- Appends `(key, value)` to the pending buffer. Does not modify inner state.

### OUTER_UPDATE KEY VALUE
- KEY must be registered in outer → exit 2 if not.
- KEY's outer reducer must NOT be `unregistered` → exit 2 if it is.
- Applies immediately using the outer reducer.

### CROSS
- Processes all pending updates in insertion order per the three branches above.
- Clears the pending buffer after processing.
- If the buffer is empty, emits nothing and exits 0.

### GET_INNER KEY
- KEY must be registered in inner → exit 2 if not.
- Prints: `INNER <key>: <value>` or `INNER <key>: <unset>`

### GET_OUTER KEY
- KEY must be registered in outer → exit 2 if not (catches inner-only leakage attempts).
- Prints: `OUTER <key>: <value>` or `OUTER <key>: <unset>`

## Invariants

1. Inner-only keys NEVER appear in outer state.
2. Keys registered in outer with `unregistered` reducer always show `<unset>` unless set by a direct `OUTER_UPDATE` (which would exit 2 anyway) — so they remain permanently `<unset>`.
3. The pending buffer is only cleared by CROSS, never by GET_* or OUTER_UPDATE.
4. Processing order within a CROSS is strictly insertion order of INNER_UPDATE calls.

## Exit Codes

- `0` — success
- `2` — malformed input (duplicate register, unregistered key, blocked reducer, unknown command, wrong argument count)
