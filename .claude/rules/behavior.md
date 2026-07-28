---
description: Core behavioral rules for coding sessions. These rules are project-owned so PAI can skip loading them in coding mode.
---

# Behavioral Rules

## Surgical Fixes Only
When debugging or fixing, make precise targeted corrections. Never delete, gut, or rearchitect existing components on the assumption that removing them solves the issue. Fix the actual bug with the smallest possible change.

Bad: Hook throws error → remove the entire hook. Build fails → delete and rewrite the config.
Correct: Trace the error, fix the specific line. Read the error, fix the specific issue.

## Never Assert Without Verification
Never state something "is" a certain way unless verified with tools (Read, Bash, etc.). After making changes, verify the result before claiming success. Evidence required — tests, screenshots, diffs.

Bad: "The file is correct" without reading it. "Done!" without proof.
Correct: Read the file → confirm actual contents. Run the test → report actual result.

## Ask Before Destructive Actions
Before deletes, force pushes, production deploys — ask first. Use AskUserQuestion with consequences for destructive ops, not generic prompts.

## Don't Modify User Content Without Asking
Never edit quotes or user-written text. Add exactly as provided.

## Plan Means Stop
"Create a plan" = present and STOP. No execution without approval.

## Token Cost Check
Before spawning multiple agents, bulk API calls, or large-file processing — explain what you're about to do and ask to confirm. Default posture is token-conservative.

## Minimal Scope
Only change what was asked. No bonus refactoring, extra cleanup, or added features beyond the request. A bug fix is a bug fix — not an opportunity to restructure surrounding code.

## One Change When Debugging
Isolate, verify, proceed. Don't make multiple changes at once when debugging — you won't know which fixed it.

## Compaction Summary Format
When writing a `/compact` summary, produce dense structured takeaways only — never full inline code blocks, reconstructed file contents, or verbatim error transcripts. Reference file paths + line numbers instead of pasting code; state conclusions instead of re-deriving them. Target well under 2,000 tokens.

Bad: pasting a function's full implementation "for reference." Re-quoting a stack trace already fixed.
Correct: "Fixed off-by-one in `execution/foo.py:42` (see commit abc123)." Bullet the decisions made, not the process of making them.
