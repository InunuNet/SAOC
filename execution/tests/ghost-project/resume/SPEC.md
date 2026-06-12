# Resume — Specification

## Overview

Resume models node re-execution with positional resume-value binding. Each node is a
sequence of EFFECT and INTERRUPT directives. A RUN walks the sequence until the first
INTERRUPT. A RESUME re-executes the entire sequence from the top, consuming answer
values for each INTERRUPT in order.

## Grammar

### node.txt (tab-separated)

```
EFFECT<TAB><LABEL>     — a named side-effect at this position
INTERRUPT<TAB><QUESTION> — a pause point that requires a value to continue
```

Blank lines and lines starting with `#` are ignored.

### run_file.txt

```
RUN                    — first execution
RESUME<TAB>v1,v2,...   — resume with comma-separated positional values
```

Each line is processed in order. Multiple RUN/RESUME commands are allowed.

## Execution Semantics

### RUN

Walk node.txt top-down:

- For each `EFFECT` → emit `EFFECT <LABEL>`
- At the first `INTERRUPT` → emit `INTERRUPTED: <QUESTION>` and STOP

If there are no INTERRUPTs the node runs to completion silently.

### RESUME v1,v2,...

**Full re-execution from the top — not continuation from the interrupt point.**

This is the critical invariant: RESUME does NOT resume where RUN stopped. It
re-executes the entire node. This means EFFECTs before the first INTERRUPT will
fire again.

Walk node.txt top-down:

- For each `EFFECT` → emit `EFFECT <LABEL>`
- For each `INTERRUPT` → consume the next positional value `vi`, emit `ANSWERED: <QUESTION>=<vi>`
- After all nodes → emit `COMPLETED: v1,v2,...`

Values are bound positionally: the first value answers the first INTERRUPT, the second
value answers the second INTERRUPT, etc.

## Positional Binding Rules

- The number of values in RESUME MUST exactly equal the number of INTERRUPT directives
  in the node. Any mismatch (too few or too many) is an error → exit 2.
- Values are consumed in encounter order as the node is walked top-down.
- Swapping the order of values in `RESUME` changes which INTERRUPT receives which answer.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | Protocol error: RESUME before RUN, value count mismatch, unknown directive |

## Example

Given a node with two INTERRUPTs:

```
EFFECT   counter_inc_A
INTERRUPT first_question
EFFECT   counter_inc_B
INTERRUPT second_question
```

**RUN output:**

```
EFFECT counter_inc_A
INTERRUPTED: first_question
```

**RESUME alpha,beta output:**

```
EFFECT counter_inc_A          ← fires again (full re-execution)
ANSWERED: first_question=alpha
EFFECT counter_inc_B
ANSWERED: second_question=beta
COMPLETED: alpha,beta
```

Note that `counter_inc_A` appears in both RUN and RESUME output. An implementation
that continues from the interrupt point rather than re-executing would incorrectly
omit the first EFFECT on RESUME.
