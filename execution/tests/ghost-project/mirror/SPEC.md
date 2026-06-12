# Mirror — Specification

**Version:** 1.0
**Build path:** `execution/tests/ghost-project/mirror/`

---

## Purpose

Mirror is a deterministic pub/sub event processor. It implements **self-publish suppression**: a publisher is excluded from delivery of their own messages, even if they hold a subscription on the topic. This is the distinguishing invariant that separates a correct implementation from a naive one.

---

## Operations

### SUBSCRIBE

```
SUBSCRIBE<TAB>AGENT_ID<TAB>TOPIC
```

- Registers AGENT_ID as a subscriber to TOPIC.
- **Idempotent**: if AGENT_ID is already subscribed to TOPIC, this is a no-op. No error, no duplicate entry.
- Subscription list for a topic maintains **insertion order** (first subscriber stays first).
- Data structure: `dict[topic, list[agent_id]]` — do not use `set` (loses order and allows no dedup control).

### PUBLISH

```
PUBLISH<TAB>AGENT_ID<TAB>TOPIC<TAB>MESSAGE
```

- Delivers MESSAGE to every subscriber of TOPIC **except** AGENT_ID (self-publish suppression).
- AGENT_ID is the publisher. They are excluded from delivery regardless of whether they are subscribed.
- MESSAGE is everything after the 3rd tab. It may contain spaces. It must NOT contain tabs.
- If MESSAGE contains a tab, exit 2 (malformed input).
- If TOPIC has no subscribers, this is a no-op. No error.
- Delivery order follows subscription insertion order.

### INBOX

```
INBOX<TAB>AGENT_ID
```

- Prints: `AGENT_ID RECEIVED: [m1, m2, ...]`
- If AGENT_ID has received no messages (including if they are not subscribed), prints: `AGENT_ID RECEIVED: []`
- Messages are comma-space separated, no quotes.
- This is a read-only query — it does not clear the inbox.

---

## Self-Publish Suppression — The Core Invariant

**A publisher MUST NOT receive their own messages, even when subscribed.**

This is checked at delivery time in PUBLISH processing. The comparison is:

```python
for subscriber in subscriptions.get(topic, []):
    if subscriber == publisher:
        continue   # skip — self-publish suppressed
    inboxes[subscriber].append(message)
```

Wrong implementation: iterating all subscribers without this guard delivers the message to the publisher. The test fixtures are designed to catch this exact failure.

---

## Data Structures

- `subscriptions: dict[str, list[str]]` — topic → subscriber list (insertion order, deduplicated)
- `inboxes: dict[str, list[str]]` — agent_id → received messages (insertion order)

No sets. Deduplication on SUBSCRIBE is performed with `if agent_id not in subscriptions[topic]`.

---

## Input Format

- Tab-separated fields, one event per line.
- Blank lines are skipped.
- Lines with unknown OP or wrong field count → exit 2.
- Tab in MESSAGE field → exit 2.

---

## Output Format

Only INBOX operations produce output. Output goes to stdout. Errors go to stderr.

```
AGENT_ID RECEIVED: [m1, m2, m3]
AGENT_ID RECEIVED: []
```

---

## Exit Codes

| Code | Condition |
|------|-----------|
| `0` | All operations processed successfully |
| `1` | File not found or I/O error |
| `2` | Malformed input: wrong field count, unknown OP, tab in MESSAGE |

---

## Ordering Guarantees

1. Subscribers receive messages in the order they were published (per topic).
2. Within a PUBLISH, delivery visits subscribers in subscription insertion order.
3. INBOX reflects all messages received up to that point in file order.

---

## Contract Checklist

- [x] self-publish suppression — publisher excluded from delivery always
- [x] insertion order — subscription and delivery order preserved
- [x] idempotent subscribe — duplicate SUBSCRIBE is a no-op
- [x] no-subscriber publish — publish to empty topic is silent no-op
- [x] non-subscriber inbox — returns [] without error
- [x] tab-in-message — exit 2
- [x] unknown op — exit 2
- [x] stdlib only — no third-party dependencies
