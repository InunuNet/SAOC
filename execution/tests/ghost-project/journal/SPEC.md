# Journal SPEC — Write-Ahead Log Crash Recovery Simulator

## Overview

`journal.py` simulates a minimal append-only Write-Ahead Log (WAL) with checkpointing, crash markers, and recovery. The log is a newline-delimited JSON file. Each command is a single CLI invocation that reads/writes the log atomically (one process at a time — no concurrency contract).

The design exists to surface a tight cluster of recovery traps that real WAL implementations get wrong: stale checkpoints, garbage past a CRASH marker, last-writer-wins semantics, and malformed checkpoints that point past the end of the log.

---

## CLI

```
python3 journal.py append     --log <path> --key <str> --value <str>
python3 journal.py checkpoint --log <path>
python3 journal.py recover    --log <path> [--output <path>]
python3 journal.py query      --log <path> --key <str>
```

All four subcommands require `--log <path>`. If the log file does not exist, it is treated as an empty log (recover/query produce empty results; append/checkpoint create the file on first write).

---

## Log Format

Newline-delimited JSON. Each line is exactly one JSON object. Three entry types:

| Type        | Required fields                                  |
|-------------|--------------------------------------------------|
| `WRITE`     | `seq` (int), `type` ("WRITE"), `key` (str), `value` (str) |
| `CHECKPOINT`| `seq` (int), `type` ("CHECKPOINT"), `committed_through` (int) |
| `CRASH`     | `seq` (int), `type` ("CRASH")                    |

### Sequence numbers

- `seq` starts at 1 for the first entry.
- `seq` is monotonically increasing across all entry types — every appended entry (WRITE, CHECKPOINT, CRASH) gets the next integer.
- Never use `time.time()` or `datetime`. The `seq` is the only time-like quantity.

### Per-line parse rule

A line that is not valid JSON, or is a JSON object missing the fields required for its declared `type`, is a malformed log line. Behavior depends on the subcommand:

- `recover` / `query`: stop reading at the first malformed line as if EOF (treat preceding entries as the full log).
- `append` / `checkpoint`: still compute next `seq` from the longest valid prefix and append normally; do not rewrite or repair earlier lines.

This is deliberate — it matches a real WAL where torn writes at the tail are common and the only safe action is to truncate the parse at the first bad line.

---

## Command Semantics

### `append --log L --key K --value V`

1. Read all entries from `L` (using the malformed-tail rule above).
2. `next_seq = (max seq in log) + 1`, or `1` if log is empty.
3. Append one line: `{"seq": next_seq, "type": "WRITE", "key": K, "value": V}\n`.
4. Exit `0`. No stdout output.

### `checkpoint --log L`

1. Read all entries from `L`.
2. Find the maximum `seq` of any **WRITE** entry. If none exist, use `0`.
3. `next_seq = (max seq in log) + 1`, or `1` if log is empty.
4. Append one line: `{"seq": next_seq, "type": "CHECKPOINT", "committed_through": <max WRITE seq or 0>}\n`.
5. Exit `0`. No stdout output.

Note: an `append` immediately after `checkpoint` produces an in-flight write whose seq is greater than `committed_through`. That write is uncheckpointed and must be replayed by `recover`.

### `recover --log L [--output P]`

1. Read entries from `L`, stopping at first malformed line OR first CRASH entry (whichever comes first).
   - CRASH stops reading. Any well-formed entries AFTER a CRASH are garbage and MUST be ignored.
2. Among entries actually read, find the **last valid** CHECKPOINT.
   - A CHECKPOINT is **valid** iff its `committed_through` is `<=` the maximum WRITE `seq` that appears at or before that CHECKPOINT entry in the log. A CHECKPOINT whose `committed_through` exceeds the max WRITE seq seen so far is **malformed** and is ignored (use the prior valid checkpoint, or treat as no checkpoint).
   - "Last valid" means the one with the largest seq among valid checkpoints.
3. Let `cutoff = committed_through` of the last valid checkpoint, or `0` if none.
4. Build a `dict[key -> value]` by iterating WRITE entries in seq order:
   - Include a WRITE iff `seq > cutoff`.
   - For each key, the WRITE with the largest `seq` wins (last-write-wins).
5. Emit `key=value` lines sorted by key, one per line.
6. If `--output P` is given, write to file `P` (creating/truncating). Otherwise write to stdout.
7. Exit `0`.

Empty log → empty output, exit `0`.

### `query --log L --key K`

Same recovery procedure as `recover`. After building the `dict`:

- If `K` in dict: print `<value>` to stdout, exit `0`.
- Else: print `NOT FOUND` to stdout, exit `0`.

Query always exits `0`, whether or not the key was found. (The output line distinguishes the cases.)

---

## Output Format

### `recover`
```
<key1>=<value1>
<key2>=<value2>
...
```
Lines sorted by key (lexicographic). No trailing blank line required. Empty result = zero bytes written.

### `query`
```
<value>
```
or
```
NOT FOUND
```

---

## Exit Codes

| Code | Condition |
|------|-----------|
| `0`  | Normal completion (including empty log, missing key, malformed tail) |
| `2`  | Usage error: unknown subcommand, missing `--log`, missing required arg for the subcommand |

There is no exit code for "log is corrupt" — corruption is recovered from silently per the rules above. That is the entire point of a WAL.

---

## Traps

These are the load-bearing edges of the spec. An implementation that gets any of these wrong is wrong, even if the obvious cases pass.

1. **Last checkpoint wins, not first.** When multiple CHECKPOINT entries exist, recover uses the one with the largest `seq` (subject to the validity rule in #5). Iterating forward and breaking on first checkpoint is a bug.
2. **CRASH stops reading.** Once a CRASH entry is encountered, all subsequent lines — even well-formed JSON — MUST be ignored. They are post-crash garbage.
3. **Last WRITE wins per key.** Within the replay window (seq > cutoff), if the same key appears in multiple WRITEs, the WRITE with the highest `seq` defines the final value. Earlier writes for that key are discarded.
4. **`committed_through = 0` is not a "no-op" checkpoint — it is a valid checkpoint that commits nothing.** Recover MUST replay every WRITE in the log (subject to other rules) when the last valid checkpoint has `committed_through == 0`. Do not skip replay just because a checkpoint exists.
5. **Malformed checkpoint (committed_through > max WRITE seq seen) is ignored.** If a checkpoint claims to commit through a seq that exceeds the largest WRITE seq present at or before it, that checkpoint is invalid. Recover MUST fall back to the previous valid checkpoint (or to "no checkpoint" if none exists). Do not raise, do not exit 2.
6. **Empty log is valid.** `recover` on an empty or non-existent log produces zero bytes of output and exits `0`. No error.
7. **stdlib only.** No third-party dependencies. Use `json`, `sys`, `argparse`, `os`. Nothing else.
8. **In-flight writes (after the last checkpoint) are part of recovery.** A WRITE with `seq > cutoff` is replayed even if no later checkpoint exists. This is the normal case for a crash-recoverable system.
9. **Append computes next_seq from the WHOLE log, not just WRITEs.** CHECKPOINT and CRASH entries also occupy seq numbers. A log of `[WRITE seq=1, CHECKPOINT seq=2]` → next append is `seq=3`, not `seq=2`.
10. **CRASH affects reads, not writes.** A subsequent `append` after a CRASH still reads the log to compute `next_seq` — but it reads the full log (including past the CRASH if more lines exist) for seq computation only. However, `recover` after such an append still stops at the CRASH and ignores everything after it, including the new append. Translation: writing more entries after a CRASH does not "uncrash" the log; the CRASH marker is permanent until manually removed.

---

## Worked Example

Log file:
```
{"seq":1,"type":"WRITE","key":"a","value":"1"}
{"seq":2,"type":"WRITE","key":"b","value":"2"}
{"seq":3,"type":"CHECKPOINT","committed_through":2}
{"seq":4,"type":"WRITE","key":"a","value":"99"}
{"seq":5,"type":"WRITE","key":"c","value":"3"}
{"seq":6,"type":"CRASH"}
{"seq":7,"type":"WRITE","key":"a","value":"GARBAGE"}
```

`recover`:
- Read stops at seq=6 (CRASH). seq=7 is ignored.
- Last valid checkpoint: seq=3, committed_through=2.
- Replay WRITEs with seq > 2: seq=4 (a=99), seq=5 (c=3).
- Final dict: {a: "99", c: "3"}.  Note that key `b` is NOT in the output — it was checkpointed and is no longer in the replay window.

Wait — that's a subtle additional rule. Read carefully: recover output is built ONLY from replayed WRITEs (seq > cutoff). Pre-checkpoint state is assumed durable elsewhere and is NOT in scope for this simulator. This simulator outputs the **redo set**, not the full database state.

Output:
```
a=99
c=3
```

`query --key a` → `99`
`query --key b` → `NOT FOUND` (b is durable but not in the redo set)
`query --key z` → `NOT FOUND`

---

## Design Decisions

1. **Redo-only recovery output.** This simulator models the WAL redo phase, not durable storage. Recover output is the set of writes that would need to be replayed against the durable store, not the full key-value state of the system. This is what makes the trap on `committed_through=0` interesting: it says "the durable store is empty; replay everything."
2. **Single process.** No fsync, no locking, no concurrency. The contract is purely about replay correctness given a log file.
3. **No timestamps.** `seq` is the only ordering. Eliminates the ambiguity of `time.time()` collisions and makes tests deterministic.
4. **Malformed-tail tolerance.** Real WALs end mid-write on crash. We tolerate torn tails by truncating parse at the first bad line — but we do NOT repair them.
5. **CRASH is a logical marker, not a parse error.** It is a well-formed JSON entry. Tests can inject CRASH markers to simulate failure points without truncating the file.
