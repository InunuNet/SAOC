# Resume — Node Re-execution with Positional Resume-Value Binding

## The Re-execution Trap

The core insight of this project is subtle: **RESUME re-executes the entire node from
the top**, not from where RUN stopped. This means any EFFECT that appeared before the
first INTERRUPT will fire again on RESUME.

A naive continuation-style implementation would skip those early EFFECTs on RESUME.
The fixture `resume_basic_expected.txt` is designed to expose this: `counter_inc_A`
appears twice in the expected output — once from RUN, once from RESUME.

## CLI

```bash
python3 resume.py <node_file> <run_file>
```

### node_file format (tab-separated)

```
EFFECT<TAB><LABEL>       — named side effect
INTERRUPT<TAB><QUESTION> — pause point
# comment lines and blank lines are ignored
```

### run_file format

```
RUN                      — first execution (stops at first INTERRUPT)
RESUME<TAB>v1,v2,...     — re-execute with positional answer values
```

## Positional Binding

Values in RESUME are bound positionally to INTERRUPTs in top-down encounter order:

- First value → first INTERRUPT
- Second value → second INTERRUPT
- etc.

Order matters: `RESUME beta,alpha` produces different output than `RESUME alpha,beta`
for the same node.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | RESUME before RUN, value count mismatch (too few or too many), unknown directive |

## Running Tests

```bash
# From repo root:
bash execution/tests/ghost-project/resume/tests/run_tests.sh

# Or from the project directory:
cd execution/tests/ghost-project/resume
bash tests/run_tests.sh
```

## Test Coverage

1. **basic** — full re-execution with positional binding (discriminator test)
2. **boundary** — EFFECTs before and after a single INTERRUPT
3. **resume-before-run** — RESUME without prior RUN → exit 2
4. **value-count-mismatch** — too few values → exit 2
5. **extra-values** — too many values → exit 2
6. **positional-swap** — same node, swapped values → different answers
