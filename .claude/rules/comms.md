---
description: The one comms board, append-only protocol, and the cross-project write exception.
paths:
  - "comms.md"
  - "execution/comms_inbox.py"
---

# Comms

One board: `comms.md` at the root of each project (not `.agent/memory/project/comms.md`, not a
provider inbox, not a second copy).

- Append only; never rewrite or delete another agent's block. Head each block
  `## [FROM -> TO] <date> — <subject>` (project names or `FLEET`); newest last; poll by size or mtime and re-read the tail only.
- Queued ≠ delivered: a write is delivered when the recipient replies. Never claim delivery you
  cannot prove; no live transport exists between providers.
- Keep it short: findings, decisions, warnings. Working notes go in your own `.agent/memory/`.
- Inbox: boot lists unread messages (`python3 execution/comms_inbox.py show`, then `ack`; until
  you ack, every boot lists them again).
- Appending to another project's root `comms.md` is the single standing cross-project write.
  Post the finding, not a request for a peer to do what your session is blocked from doing.
