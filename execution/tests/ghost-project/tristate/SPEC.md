# Tristate Specification

## 1. Input Format

Input is a plain-text file with exactly 3 sections separated by ONE blank line.

### Section 1: NODES

```
NODES
NODE_ID OUTCOME [VALUE]
```

- `NODE_ID` — unique identifier (no spaces)
- `OUTCOME` — one of `ok`, `empty`, `failed` (case-insensitive in input)
- `VALUE` — required when OUTCOME is `ok`; everything after the outcome token on
  the same line. Absent for `empty` and `failed`.
- Duplicate NODE_ID is an error (exit 2).

### Section 2: DEPS

```
DEPS
DOWNSTREAM_ID UPSTREAM_ID POLICY
```

- `POLICY` — one of `strict`, `lenient`, `any`
- Multiple dep lines for the same DOWNSTREAM_ID are allowed, but ALL must use
  the same POLICY. Mixed policies for the same downstream is an error (exit 2).
- Both DOWNSTREAM_ID and UPSTREAM_ID must refer to declared nodes (exit 2 otherwise).
- Self-dependencies (DOWNSTREAM_ID == UPSTREAM_ID) are an error (exit 2).
- Cycles in the dependency graph are an error (exit 2).

### Section 3: OUTPUT

```
OUTPUT
OUTPUT NODE_ID
```

Exactly one `OUTPUT NODE_ID` line. NODE_ID must refer to a declared node (exit 2).

---

## 2. Evaluation

Nodes are evaluated in topological order (sources first).

**Source nodes** (no incoming dependencies): keep their declared OUTCOME and VALUE.

**Downstream nodes**: resolved based on all upstream resolved statuses and POLICY:

| Policy | Rule |
|--------|------|
| `strict` | Any upstream that is NOT `ok` (i.e., `empty` or `failed`) → downstream becomes `failed` |
| `lenient` | Any upstream that is `failed` → downstream becomes `failed`. `empty` upstreams are tolerated. |
| `any` | Downstream keeps its declared OUTCOME and VALUE regardless of upstream statuses. |

When a downstream node is forced to `failed`, its VALUE becomes absent.

---

## 3. Output Format

One line per node in NODES declaration order:

```
NODE_ID OK VALUE      # outcome=ok
NODE_ID EMPTY         # outcome=empty
NODE_ID FAILED        # outcome=failed
OUTPUT: value         # output node is ok — print its value
OUTPUT: EMPTY         # output node is empty
OUTPUT: FAILED        # output node failed
```

---

## 4. Exit Codes

| Code | Condition |
|------|-----------|
| 0 | Successful evaluation |
| 2 | Any of: malformed section header, wrong number of sections, unknown NODE_ID in DEPS or OUTPUT, mixed policies for the same downstream, self-dependency, cycle, duplicate NODE_ID |

---

## 5. Constraints

- stdlib Python only — no third-party dependencies.
- Single-file implementation (`tristate.py`).
- All validation (referential integrity, cycle detection, mixed policies) must
  happen before any output is produced.
