# Escrow — Lamport Logical Clock Simulator

Escrow reads a distributed system event trace and computes the Lamport logical clock timestamp for each event. It is a single-file, stdlib-only Python tool with no third-party dependencies.

---

## CLI Usage

```bash
python3 escrow.py events.txt
```

Reads `events.txt`, prints one timestamped event per line to stdout, exits 0 on success.

---

## Input Format

One event per line, space-separated:

| Format                    | Description                                             |
|---------------------------|---------------------------------------------------------|
| `PROC_ID INTERNAL`        | Internal event on PROC_ID                               |
| `PROC_ID SEND OTHER_PROC` | PROC_ID sends a message to OTHER_PROC                   |
| `PROC_ID RECV OTHER_PROC` | PROC_ID receives the next unmatched message from OTHER_PROC |

Blank lines are ignored. Identifiers can be any non-whitespace string.

---

## Output Format

```
PROC_ID EVENT_TYPE CLOCK_VALUE
```

One line per input event, in order.

---

## Exit Codes

| Code | Meaning                                                       |
|------|---------------------------------------------------------------|
| 0    | Success                                                       |
| 2    | Invalid input: malformed line or RECV with no matching SEND   |

---

## Examples

### Simple three-event trace

```
A INTERNAL
A SEND B
B RECV A
```

Output:
```
A INTERNAL 1
A SEND 2
B RECV 3
```

### Larger trace

```
A INTERNAL
A SEND B
B INTERNAL
B RECV A
B SEND C
A INTERNAL
C RECV B
C INTERNAL
A SEND B
B RECV A
```

Output:
```
A INTERNAL 1
A SEND 2
B INTERNAL 1
B RECV 3
B SEND 4
A INTERNAL 3
C RECV 5
C INTERNAL 6
A SEND 4
B RECV 5
```

### Error: RECV with no matching SEND

```
A RECV B
```

Exit code 2, stderr message explaining the unmatched RECV.

---

## Running Tests

From the Athanor project root:

```bash
bash execution/tests/ghost-project/escrow/tests/run_tests.sh
```

Or from inside the escrow directory:

```bash
bash tests/run_tests.sh
```

---

## The Trap: Which Clock Rule is Most Often Gotten Wrong?

The RECV rule is the most commonly misimplemented part of Lamport clocks.

**Correct rule:**
```
clock[proc] = max(clock[proc], sender_clock_at_send_time) + 1
```

**Common wrong version:**
```
clock[proc] = sender_clock_at_send_time + 1   # ignores local clock
```

**Why this matters:** If a process has advanced its clock to 5 via local work, and then receives a message sent when the sender's clock was 1, the correct result is `max(5, 1) + 1 = 6`. The wrong version gives `1 + 1 = 2`, silently rolling the clock backward — violating the fundamental Lamport monotonicity guarantee that `clock` is always strictly increasing per process.

The boundary fixture (`escrow_boundary.txt`) specifically exercises this case:
- A does 5 INTERNAL events → clock=5
- B sends at clock=1
- A RECV B → must be 6, not 2

---

## Implementation Notes

**Status: PASS 5/5**

The canonical implementation in `escrow.py` passes all five test fixtures.

Key algorithmic point: the RECV rule applies **max-then-+1**, not +1-only:

```python
clock[recver] = max(clock.get(recver, 0), sent_clock) + 1
```

This single line is the entire correctness surface. The `max` prevents the clock from rolling backward when a receiver is ahead of the sender; the `+1` advances the clock to mark the receive event itself. SEND events advance only the sender's clock. INTERNAL events advance only the acting process's clock. Dangling SENDs (messages never received) and empty input are treated as success (exit 0).
