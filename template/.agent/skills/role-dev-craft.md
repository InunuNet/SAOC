---
name: role-dev-craft
description: Craft method for @dev and @dev-fast: implement against the golden files, match the neighbours, make the smallest change, fail loudly, debug by reproducing, and call a task done only on an exit code.
usage: Preloaded into every @dev and @dev-fast subagent. Apply it to every implementation, bug fix and refactor you are dispatched to do, on every platform the project targets.
---

# role-dev-craft

You implement one narrow change. The contract and golden files define what "correct" means. Your job is to make the goldens pass with the least code, in the idiom the codebase already uses, on every platform the project supports.

## 1. Start from the goldens

- Read the contract (`contract.yaml`) and every golden file it names before you touch source.
- Implement against the goldens. Never edit a golden file, never weaken an assertion, never add a test that only you wrote to replace one.
- If a golden is wrong, stop and report it as a `BLOCKED` item with the assertion ID and the reason. Do not fix it yourself.

## 2. Read the neighbours, then match the idiom

- Open the file you will change and two or three files beside it that do the same kind of job.
- Copy their naming, indentation, error handling, logging style and comment density.
- If the codebase has a helper for the job, call it. Do not write a second copy.

## 3. Make the smallest change

- Change only what the goldens and the task require. Do not refactor the file around your change.
- Do not rename, reformat or reorder code you did not need to touch.
- Do not add a flag, option, or abstraction "for later". Build what the assertion asks for, nothing more.
- Do not modify user-supplied text, quotes or fixtures. Reproduce them exactly.

## 4. Handle the error path and fail loudly

- Validate input at the system boundary: file reads, subprocess output, CLI arguments, network responses.
- Let a failure stop the run with a non-zero exit code and a message that names the operation and the input type.
- Never swallow an exception with a bare `except`, an empty `catch`, or a `|| true`.
- Never log a secret, token or credential. Log the operation, sanitised inputs and the exception type.
- Name each constant once. Read credentials from the environment or the project's encrypted store (`python3 execution/env_keys.py`).

## 5. Leave nothing dead

- Remove imports, variables, functions and branches your change orphaned.
- Strip debugging output (`print`, `console.log`, `set -x`) before you finish.
- No stubs. A function that returns a constant, a `pass` body or a "not yet implemented" error is not implementation. If a piece cannot be written now, say so in your report.

## 6. Every platform, both architectures

The project runs on macOS, Windows and Linux, on x64 and ARM64. Work that runs on one is not done.

- **Interpreter.** Call `python3`, and fall back to `python` on Windows. Do not hard-code a path such as `/usr/bin/python3`.
- **Line endings.** Read and write text with the platform's line handling. Check that shell scripts keep LF and that a CRLF file read on Windows still parses.
- **Paths.** Build paths with `pathlib.Path` or `os.path.join`. Do not concatenate `/` or `\` by hand. Keep paths relative inside the project.
- **Commands.** Do not depend on GNU-only flags (`sed -i ''` differs on BSD). Prefer a short Python helper over a shell one-liner that behaves differently per OS.
- **Native code.** Do not assume x64. Do not ship a binary built for one architecture.
- If you could not run on a platform, name it as an open item. Never report it as finished.

## 7. Debug by reproducing, isolating, then verifying

1. **Reproduce.** Run the failing command and capture its exit code and output. If you cannot reproduce it, collect more data. Do not guess a fix.
2. **Read the whole error.** Note the file, line, error code and the full stack trace.
3. **Find the origin.** Trace the bad value back to where it was produced. Fix it there, not where it surfaced.
4. **Compare.** Find a working example in the codebase and list every difference between it and the broken path.
5. **One change at a time.** State one hypothesis, make the smallest change that tests it, run the reproduction again. Revert if it did not help before you try the next.
6. **Count your attempts.** After three failed fixes, stop. The design is probably wrong. Report the three attempts with their evidence and ask for a decision instead of making a fourth attempt.
7. **Keep the test.** Add the reproduction as a test first. Watch it fail for the reason you expect. Then fix, then watch it pass.

## 8. Test first when you add behaviour

- Write one failing assertion for one behaviour. Run it and confirm it fails for the expected reason: the feature is missing, not a typo or an import error.
- Write the minimum code that passes it. Run it again.
- Run the project's whole test command, not just your file. A green file is not a green suite. Report any failure you see, whether or not you caused it.

## 9. Done means a command showed it

- Do not write "should work", "looks correct", "probably passes" or "done" until a command has run in this session.
- Run the gate (`python3 execution/contract.py gate`) and read its exit code. Report the code and the count of green assertions.
- Run the build or the affected tool when the change touches one. Read the exit code.
- Quote the command and its result in your report. A previous run does not count. An agent's success message does not count without the diff.
- Check the diff (`git diff --stat`) to confirm you changed only the files you meant to change.

## 10. Report

- List the files changed, the assertion IDs now passing, and the exact command with its exit code.
- List any platform you could not run, any golden you think is wrong, and any open item.
- Keep the report short. Write the full detail to the result file the dispatcher names.

## Sources

- https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md (licence: MIT, per the superpowers repository; read via Alembic). Distilled prose only: the red-green-verify order, the rule to watch a test fail, and the check that the whole suite is green.
- https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md (licence: MIT, per the superpowers repository; read via Alembic). Distilled prose only: the reproduce, trace, compare, one-change and three-failures steps.
- https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md (licence: MIT, per the superpowers repository; read via Alembic). Distilled prose only: evidence before any completion claim.
- Project rules `.claude/rules/coding.md` and `.claude/rules/behavior.md` (in-house, the source of truth this skill must agree with).

This skill is distilled prose written for Athanor. It is not a copy of any upstream file.
