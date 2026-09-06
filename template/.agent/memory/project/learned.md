# Learned Lessons

Craft lessons that hold in every project. Everything below was paid for once and
should not be paid for twice. Add what THIS project learns; nothing here is about
any other project's history.

## Testing and verification

- **A green gate proves nothing until you have watched its assertions fail.** An
  assertion never seen to fail is not yet known to observe anything. Break the
  thing on purpose, confirm the gate goes red for the right reason, then fix it.
- **If a feature's job is removing a hardcoded value, no test may use that value.**
  The test then passes for the same reason the bug survived.
- **"Empty but valid" is a distinct test case from "missing" and from "malformed".**
  Three different states, three different code paths, three different tests.
- **Test the property, not last round's examples.** Where the invariant can be
  stated, generate the cases from it. A fixed list of known-bad inputs becomes the
  specification, and the next bug lives in the gap.

## Working with tools and text

- **Sanitisers: normalise first, strip forbidden tokens last, loop until stable.**
  A single pass can manufacture the very token it just removed out of the pieces
  either side of it.

## Working with other agents

- **Verify a subagent's claim before repeating it.** A confident report is not
  evidence. Read the file, run the command, then say it.
- **A measured number goes stale in a repo with concurrent agents — date it.**
  Counts, sizes and timings are true as of a moment. Write the date beside them or
  they become confident fiction.
