# Tristate — Task Status Propagation Engine

Tristate evaluates a directed acyclic graph of tasks, propagating ok/empty/failed
status through dependencies according to a configurable policy.

## CLI

```
python3 tristate.py graph.txt
```

Reads `graph.txt`, evaluates all node statuses in topological order, and prints
one line per node (in declaration order), then the designated output.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success — graph evaluated and output printed |
| 2 | Input error — malformed sections, unknown node ID, mixed policies, cycle, self-dep, duplicate node ID |

## Output Format

```
NODE_ID OK value      # node resolved to ok with VALUE
NODE_ID EMPTY         # node resolved to empty
NODE_ID FAILED        # node resolved to failed
OUTPUT: value         # designated output node's value
OUTPUT: EMPTY         # designated output node is empty
OUTPUT: FAILED        # designated output node failed
```

## The Tristate Propagation Trap

The critical correctness hazard is conflating "lenient" with "any":

- `strict` — ANY upstream not-ok (empty OR failed) makes the downstream fail.
- `lenient` — FAILED upstreams propagate failure; EMPTY upstreams are tolerated.
- `any` — the downstream keeps its declared status regardless of upstream outcomes.

A common mistake is treating `lenient` as if empty upstreams should fail. They
should not. Lenient means: "I can work without those inputs, but a hard failure
upstream blocks me."

Similarly, `any` does NOT mean "any upstream ok makes me ok." It means the
downstream is unconditional — its declared status is final.

## Example

```
NODES
A ok alpha_val
B empty
C ok carlos_val
D ok delta_val

DEPS
C A strict
D B lenient

OUTPUT
OUTPUT D
```

Output:
```
A OK alpha_val
B EMPTY
C OK carlos_val
D OK delta_val
OUTPUT: delta_val
```

C depends on A (strict). A=ok, so C stays ok.
D depends on B (lenient). B=empty — lenient tolerates empty — so D stays ok.
