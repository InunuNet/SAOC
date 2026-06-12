# Mirror — Pub/Sub Self-Publish Suppression

Mirror is a deterministic pub/sub event processor with **self-publish suppression**: a publisher never receives their own messages, even if they are subscribed to the topic.

## The Trap

The classic wrong implementation delivers a PUBLISH to all subscribers including the publisher. Mirror enforces the rule: **the sender is excluded from delivery, always**.

```
SUBSCRIBE  alice  news
SUBSCRIBE  bob    news
PUBLISH    alice  news  hello

Wrong impl:  alice RECEIVED: [hello]   ← alice gets her own message
Mirror:      alice RECEIVED: []        ← self-publish suppressed
             bob   RECEIVED: [hello]
```

## Usage

```bash
python3 mirror.py events.txt
```

`events.txt` is a tab-separated file, one event per line.

## Event Format

| Op | Fields | Description |
|----|--------|-------------|
| `SUBSCRIBE` | `AGENT_ID` `TOPIC` | Subscribe AGENT_ID to TOPIC. Idempotent — re-subscribing is a no-op. |
| `PUBLISH` | `AGENT_ID` `TOPIC` `MESSAGE` | Deliver MESSAGE to all subscribers of TOPIC **except** AGENT_ID. MESSAGE may contain spaces but must not contain tabs. |
| `INBOX` | `AGENT_ID` | Print `AGENT_ID RECEIVED: [m1, m2, ...]` or `AGENT_ID RECEIVED: []`. |

Fields are separated by a single tab character (`\t`).

## Output

`INBOX` commands produce one line each:

```
alice RECEIVED: []
bob RECEIVED: [hello-world]
carol RECEIVED: [m1, m2, m3]
```

- Messages are comma-space separated, no quotes.
- Non-subscriber INBOX returns `[]` (not an error).
- Delivery order is subscription insertion order.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | File not found or I/O error |
| `2` | Malformed input: wrong field count, unknown OP, or tab in MESSAGE |

## Running Tests

```bash
bash tests/run_tests.sh
```

Tests cover: basic self-publish suppression, multi-agent ordering, no-subscriber publish, publisher-not-subscribed, duplicate subscription, and self-only topic.
