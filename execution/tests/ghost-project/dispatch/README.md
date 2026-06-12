# dispatch — Conditional-Edge Multi-Target Routing with Deduplication

`dispatch` reads a tab-separated routing table and resolves per-source task lists in
declaration order, with a critical asymmetry: ROUTE is deduplicated, SEND is not.

## The Dedup Trap

```
ROUTE   a   b       ← declared
ROUTE   a   b       ← duplicate — silent no-op
ROUTE   a   b       ← duplicate — silent no-op
RESOLVE a           → TASK b      (only 1 task)

SEND    a   b   p   ← appended
SEND    a   b   p   ← appended (no dedup)
SEND    a   b   p   ← appended (no dedup)
RESOLVE a           → TASK b p
                       TASK b p
                       TASK b p   (3 tasks)
```

This asymmetry is intentional: ROUTE declares a static edge (idempotent); SEND enqueues
a parameterized message (not idempotent).

## CLI

```
python3 dispatch.py routes.txt
```

Output goes to stdout. Errors go to stderr.

## Input Format

Tab-separated file, one command per line:

| Command | Fields | Behavior |
|---------|--------|----------|
| `ROUTE` | `ROUTE<TAB>SOURCE<TAB>TARGET` | Add deduplicated string-target route |
| `SEND`  | `SEND<TAB>SOURCE<TAB>TARGET<TAB>PAYLOAD` | Append parameterized send (never deduped) |
| `RESOLVE` | `RESOLVE<TAB>SOURCE` | Output all tasks for SOURCE in declaration order |

## Output Format

RESOLVE outputs one line per task:
- String route: `TASK <TARGET>`
- Parameterized send: `TASK <TARGET> <PAYLOAD>`

If a source has no declarations, RESOLVE produces no output (not an error).

## Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 2    | Wrong field count for a command, or unknown command |

## Examples

### Basic (dedup + non-dedup mixed)

Input:
```
ROUTE	a	b
ROUTE	a	b
SEND	a	b	p1
SEND	a	b	p1
SEND	a	b	p2
RESOLVE	a
```

Output:
```
TASK b
TASK b p1
TASK b p1
TASK b p2
```

Two ROUTE to same target → 1 TASK. Three SENDs → 3 TASKs. Declaration order preserved.

### Boundary (empty source + mixed ordering)

Input:
```
ROUTE	x	a
SEND	x	a	hello
ROUTE	x	a
SEND	x	c	world
ROUTE	x	b
RESOLVE	x
RESOLVE	y
```

Output:
```
TASK a
TASK a hello
TASK c world
TASK b
```

`RESOLVE y` has no declarations → no output.

## Running Tests

```bash
bash execution/tests/ghost-project/dispatch/tests/run_tests.sh
```

All 6 tests must pass.
