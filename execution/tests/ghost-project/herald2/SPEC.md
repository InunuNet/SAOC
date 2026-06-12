# herald2 — Specification

**Version:** 1.0
**Build path:** `execution/tests/ghost-project/herald2/`

---

## Purpose

herald2 dispatches messages to handlers based on keyword matching. Each handler has a name, a keyword predicate, and an action value. For each message, the dispatcher finds all matching handlers, sorts them alphabetically by name, and executes only the first.

---

## Inputs

### handlers.txt

Tab-separated file. Each non-empty line: `HANDLER_NAME<TAB>KEYWORD<TAB>ACTION_VALUE`

- `HANDLER_NAME` — non-empty string identifier for the handler
- `KEYWORD` — non-empty string; matched case-insensitively as a substring of message text
- `ACTION_VALUE` — arbitrary string; emitted as the dispatch result

Empty file (zero bytes or all blank lines) is valid — results in zero handlers registered.

### messages.txt

One message per line. Each line is a complete message string. Empty lines are valid messages (will match any handler with an empty keyword, but empty keywords are rejected at load time, so empty lines always produce UNHANDLED).

---

## Dispatch Algorithm

```
for each message M (1-indexed):
    candidates = []
    for each handler H in registry:
        if H.keyword.lower() in M.lower():
            candidates.append(H)
    if candidates is empty:
        output: "{msg_num}\tUNHANDLED"
    else:
        candidates.sort(key=lambda H: H.name)   # case-sensitive lexicographic
        winner = candidates[0]
        output: "{msg_num}\t{winner.name}\t{winner.action_value}"
```

### Sort Order

Python default string sort (`sorted()` / `list.sort()` with no key override beyond `H.name`). This is case-sensitive lexicographic: uppercase letters (`A-Z`, ASCII 65–90) sort before lowercase (`a-z`, ASCII 97–122). For handler names that are all lowercase (as in the standard fixtures), this reduces to standard alphabetical order.

### Matching Rules

- Matching is **substring**, not prefix or full-word.
- Matching is **case-insensitive** — both message and keyword are lowercased before comparison.
- A handler matches if `keyword.lower() in message.lower()`.

---

## Output Format

One line per input message, written to stdout:

```
{msg_num}\t{HANDLER_NAME}\t{ACTION_VALUE}   (match found)
{msg_num}\tUNHANDLED                        (no match)
```

`msg_num` is 1-indexed.

---

## Exit Codes

| Code | Condition |
|------|-----------|
| `0` | All messages processed successfully |
| `1` | File not found or I/O error opening inputs |
| `2` | Malformed handler line: wrong field count, empty HANDLER_NAME, or empty KEYWORD |

Validation of the handler file happens at load time before any messages are processed. If any line is malformed, herald2 exits 2 immediately.

---

## Edge Cases

| Case | Behaviour |
|------|-----------|
| Empty handlers file | All messages → UNHANDLED; exit 0 |
| Empty messages file | No output lines; exit 0 |
| Message matches multiple handlers | Sort by handler name; dispatch first only |
| Message matches zero handlers | Output UNHANDLED |
| Handler file has blank lines | Blank lines are skipped (not an error) |
| Handler name is empty string | Exit 2 |
| Keyword is empty string | Exit 2 |
| Handler line has < 3 or > 3 fields | Exit 2 |

---

## The Alphabetical Dispatch Trap

The dispatch winner is determined by **alphabetical sort of handler names**, not by declaration order in `handlers.txt`. Any implementation that iterates the handler file in sequence and fires on the first substring match will produce wrong output for messages that match more than one handler.

Example:

```
Handlers (in file order): zeta_logger/error, alpha_alerter/error, mike_metrics/latency, beta_backup/backup

Message: "Backup error during restore"
  - matches beta_backup  (keyword=backup)
  - matches alpha_alerter (keyword=error)
  - matches zeta_logger   (keyword=error)
  Sorted by name: alpha_alerter, beta_backup, zeta_logger
  Winner: alpha_alerter → PAGE_ONCALL   (NOT zeta_logger, NOT beta_backup)
```

Correct implementations must collect all matches first, then sort, then pick the winner.
