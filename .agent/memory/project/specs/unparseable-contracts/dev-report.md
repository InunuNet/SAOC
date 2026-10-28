# Dev report: unparseable-contracts

Both contracts now load as one mapping document (`check_single_doc.py` exit 0). Fix is YAML-only (quoting, indentation, escaping); assertion ids and intent unchanged.

## gate-timeout-fix

Fix: `A2` command quoted (`'grep -q "default: 300" execution/contract.py'`); the `: ` inside the plain scalar broke the mapping at line 20.
`contract.py validate --strict` exit 0.

| id | result | exit | evidence |
|----|--------|------|----------|
| A1 | FAIL | 1 | `grep -q "default=300" execution/contract.py` finds nothing: `--timeout-seconds` is `default=60` at execution/contract.py:1200 and :1211 |
| A2 | FAIL | 1 | no `default: 300` text in execution/contract.py |

Reported, not fixed: the contract's goal (raise default to 300) was never applied to `execution/`, which is upstream-owned (athanor.md). Needs an upstream change or a decision that the contract is obsolete.

## mission-slug-collision-fix

Fix: indentation only. The heredoc body in A1 and A2 is indented 8 spaces so it stays inside the `command: |` block scalar (its `---` lines at column 0 ended the block and broke the document). No command text changed: an earlier `SLUG="test-"collision` quote trick was reverted, because it altered the command to dodge a validator bug.

Verification (method, in `.tmp/sandbox/contract-yaml-verify/`):
- `git diff -w origin/main` on the file is empty: every change is whitespace.
- The fixed file parses. Its A1/A2 `command` strings equal origin/main's raw text for those blocks with the 8-space block indent stripped (`compare.py`, exit 0, both `equal=True`). Negative control: the quote-trick version fails the same comparison (exit 1).
- Reconstruction: indenting origin/main's heredoc lines by 8 spaces (awk) gives a file byte-identical (`cmp`) to the fixed one, and it parses with ids A1, A2, A3. origin/main itself does not parse (error at line 28, column 1).

`contract.py validate --strict` exit 1, only the known validator false positives tracked upstream as InunuNet/Athanor#1471:
- `Assertion A1: multiline python3 -c is prohibited`
- `Assertion A2: multiline python3 -c is prohibited`

The check matches the substring `-c` across the multi-line command (from `test-collision`). It is not a real `python3 -c`.

| id | result | exit | evidence |
|----|--------|------|----------|
| A1 | NOT-RUN | n/a | blocked by the autonomy floor: command runs `rm -rf $TEMP_MISSIONS_DIR` (denied rm -rf and variable-path rm) |
| A2 | NOT-RUN | n/a | blocked by the autonomy floor: same `rm -rf $TEMP_MISSIONS_DIR` |
| A3 | PASS | 0 | `python3 execution/tests/test_mission.py`: 19/19 passed |
