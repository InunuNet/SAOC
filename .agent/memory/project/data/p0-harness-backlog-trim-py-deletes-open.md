# p0-harness-backlog-trim-py-deletes-open

**[P0] Harness `backlog_trim.py` deletes open items without archiving them** (found
  2026-09-08, mission ticketing-complete). `execution/backlog_trim.py:126-141` archives closed
  `[x]` items to the brain, but open `[ ]` items past `MAX_OPEN=50` are removed with no archive
  and no titles recorded — only a `> Truncated N items` marker. This file already carries
  **5 such markers, 248 items destroyed** (127/5/9/104/3), one of them a standing P1 that was
  only noticed missing because an architect went looking for it by name. The cutoff is by file
  *position*, not priority, so newly-appended P0/P1 items die first. **This file is at 57 open
  items against MAX_OPEN=50 right now — the next `make backlog-trim` deletes 7 items off the
  bottom.** Do not run it until upstream lands a fix; curate by hand instead. Filed upstream as
  InunuNet/Athanor#1413 (never patch `execution/` in place — `make update-template` reverts it).
  Blocked on: upstream. Deliberately placed at the TOP of the open items, because the bottom is
  the kill zone.
