# Silo

Per-(type, key) actor instantiation registry. Tracks independent counters for
`(AGENT_TYPE, KEY)` pairs — complete isolation between distinct key values even
within the same agent type.

## Quick Start

```bash
python3 silo.py invocations.txt
```

## Input Format

Tab-separated, three fields per line:

```
AGENT_TYPE<TAB>KEY<TAB>OPERATION
```

Operations: `INIT`, `INCREMENT`, `GET`

## Example

```
reviewer	req-1	INIT
reviewer	req-2	INIT
reviewer	req-1	INCREMENT
reviewer	req-1	INCREMENT
reviewer	req-2	INCREMENT
reviewer	req-1	GET
reviewer	req-2	GET
```

Output:

```
reviewer req-1 2
reviewer req-2 1
```

The asymmetric counts (2 vs 1) prove `(reviewer, req-1)` and `(reviewer, req-2)` are
tracked independently. A broken implementation keying by type alone would output equal counts.

## Error Cases

All exit with code 2 and empty stdout:

- Duplicate `INIT` on the same `(AGENT_TYPE, KEY)` pair
- `INCREMENT` or `GET` on an uninitialized pair
- Unknown operation
- Wrong number of fields
- Empty lines

## Tests

```bash
bash tests/run_tests.sh
```

## Spec

See [SPEC.md](SPEC.md) for full specification.
