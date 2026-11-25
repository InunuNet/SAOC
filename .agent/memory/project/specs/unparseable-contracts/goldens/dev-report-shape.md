# Golden: shape of the dev report (written by @dev to .agent/memory/project/specs/unparseable-contracts/dev-report.md)

One section per fixed contract, headed with its slug (`## gate-timeout-fix`, `## mission-slug-collision-fix`). Each section lists
every assertion id with: PASS, FAIL, or NOT-RUN, the exit code, and one line of evidence.

Rules for the run:
- The fix is YAML-only: quote or block-scalar the offending line (gate-timeout-fix line 20, the `description:` with `: ` inside)
  and indent/escape the heredoc so its `---` and blank lines stay inside the `command: |` block (mission-slug-collision-fix, ~line 28-51).
  Do not change any assertion's intent, id or the shell it runs.
- Run each contract's assertions after the fix (`python3 execution/contract.py gate <path>` or the commands individually, from the worktree root).
- An assertion that fails or cannot run because it needs a harness edit (execution/ is upstream-owned, see .claude/rules/athanor.md) or because
  the autonomy floor blocks it (the mission-slug-collision assertion uses `rm -rf $TEMP_MISSIONS_DIR`, which the floor denies) is REPORTED
  with its exit code and reason. It is not fixed, not skipped silently, and execution/ is not edited.
- Do not weaken or delete an assertion to make a run green.
