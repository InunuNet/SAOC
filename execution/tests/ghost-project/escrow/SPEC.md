# Escrow — Lamport Logical Clock Simulator: Specification

## Purpose

Escrow simulates Lamport logical clocks for a set of concurrent processes communicating via message passing. It deterministically computes the Lamport timestamp for each event in a trace file and outputs the results in order.

This tool is used to validate understanding of the Lamport Clock algorithm and to verify that distributed system event traces are correctly timestamped.

---

## Input Format

A plain-text file with one event per line. Fields are space-separated.

### Event Types

| Line Format               | Meaning                                      |
|---------------------------|----------------------------------------------|
| `PROC_ID INTERNAL`        | An internal event on process PROC_ID         |
| `PROC_ID SEND OTHER_PROC` | Process PROC_ID sends a message to OTHER_PROC |
| `PROC_ID RECV OTHER_PROC` | Process PROC_ID receives the next unmatched message from OTHER_PROC |

- `PROC_ID` and `OTHER_PROC` are arbitrary non-whitespace identifiers (e.g. `A`, `B`, `P1`).
- Blank lines are ignored.
- Any other format is a malformed line.

---

## Clock Algorithm (Exact)

Each process starts with a clock value of `0`.

| Event   | Rule                                                                   |
|---------|------------------------------------------------------------------------|
| INTERNAL | `clock[proc] += 1` — then output the new value                       |
| SEND     | `clock[proc] += 1` — then output the new value; enqueue clock value  |
| RECV     | `clock[proc] = max(clock[proc], sender_clock_at_send_time) + 1`; output new value |

The `+1` in RECV applies **after** the max, not before. The final clock value is always strictly greater than both the local pre-receive clock and the sender's send-time clock.

---

## SEND/RECV Matching Semantics

SEND and RECV events are matched in FIFO order per (sender, receiver) pair:

- `Q RECV P` consumes the **earliest unmatched** `P SEND Q` that appears **above it in the file**.
- The match is per directed channel: `(sender=P, receiver=Q)`.
- If `Q RECV P` is encountered and no unmatched `P SEND Q` exists above it, the simulator exits with code 2.
- Unmatched SENDs at end-of-file are silently ignored (a SEND with no corresponding RECV is valid — the message was sent but not yet received in this trace).

---

## Output Format

One line per event, in the same order as the input:

```
PROC_ID EVENT_TYPE CLOCK_VALUE
```

Fields are space-separated. `EVENT_TYPE` is `INTERNAL`, `SEND`, or `RECV`.

---

## Exit Codes

| Code | Meaning                                                    |
|------|------------------------------------------------------------|
| 0    | Success — all events processed                             |
| 2    | Invalid input — malformed line or RECV with no matching SEND |

---

## Examples

### Basic trace

Input:
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

Trace: A's clock goes 0→1 (INTERNAL), 1→2 (SEND, enqueues clock=2). B's clock goes 0→max(0,2)+1=3.

### Boundary: local clock dominates

Input:
```
A INTERNAL
A INTERNAL
A INTERNAL
A INTERNAL
A INTERNAL
B SEND A
A RECV B
```

Output:
```
A INTERNAL 1
A INTERNAL 2
A INTERNAL 3
A INTERNAL 4
A INTERNAL 5
B SEND 1
A RECV 6
```

A's local clock is 5. B's send-time clock is 1. `max(5, 1) + 1 = 6`. The result is NOT 2.

---

## Common Trap: Ignoring the Local Clock on RECV

The most commonly misimplemented rule is RECV. A naive implementation might do:

```python
# WRONG — ignores local clock
clock[proc] = sender_clock + 1
```

The correct implementation:

```python
# CORRECT
clock[proc] = max(clock[proc], sender_clock) + 1
```

When a process has done substantial local work before receiving a slow message, its local clock will be ahead of the sender's clock. Using only the sender's clock resets the receiver's clock backward — violating the Lamport monotonicity guarantee.
