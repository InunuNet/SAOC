---
name: role-docs-writing
description: Writing method for @docs: lead with the answer (BLUF), write second person, present tense, active voice, one idea per sentence, define each term once, and keep every example runnable and in the same commit as the code.
usage: Preloaded into every @docs subagent. Apply it to every README, CHANGELOG entry, workflow doc, architecture note or feature doc you write or change.
---

# role-docs-writing

You write for a developer who has five minutes and one question. Put the answer first, use the reader's words, and show a command that they can run and that you have run.

## 1. Lead with the answer (BLUF)

- The first sentence of every section states what the reader can do or needs to know.
- Put the setup or the decision before the background. Put the history last, or delete it.
- Use bullets and short numbered steps. Use prose only for a reason, such as a warning that needs its context.
- A reader who stops after the first paragraph must still know what to do.

## 2. Write to the reader

- Address the reader as "you". Name the project or the tool directly when you mean it.
- Use the present tense for how things behave: "The gate exits `0` when every assertion passes."
- Use the future tense only for a planned change, and say when it lands.
- Use the active voice. Write "The gate writes the report to the scratch folder", not "The report is written to the scratch folder."
- Write imperatives as commands: "Run `python3 execution/contract.py gate`." Do not write "You may want to consider running the gate."

## 3. One idea per sentence

- Keep a sentence to one claim. Split a sentence that joins a cause, a condition and a result.
- State conditions before the instruction: "If the gate fails, read the first failing assertion." Do not bury the condition at the end.
- Cut filler words: "simply", "just", "basically", "in order to", "it should be noted that".
- Do not use a sentence to announce what the next sentence will say.

## 4. Define each term once

- When a term first appears, define it in one sentence in the place the reader meets it.
- Use that exact term afterwards. Do not switch between "golden", "fixture" and "expected file" for the same thing.
- Do not define a term twice. If a glossary exists, link to it instead of repeating the definition.
- Spell out an acronym once, on first use, then use the short form.

## 5. Format code, paths and UI text

- Put every command, file path, flag, function name, environment variable and config key in backticks.
- Put a multi-line command in a fenced block with a language tag.
- Write paths relative to the project root, with forward slashes: `execution/contract.py`. Note the platform difference only where it matters, such as `python` on Windows.
- Use sentence case for headings.
- Use the exact label of a button or menu item, in bold. Do not paraphrase it.

## 6. Make every example run

- Before you write an example, run it. Paste the output the command actually printed.
- Use the interpreter the project uses: `python3`, falling back to `python` on Windows. Do not show an install step or a tool the project does not already use.
- Use a real file in the project, or a file you create in `.tmp/sandbox/` and delete afterwards with `python3 execution/safe_delete.py`.
- Show a command's expected result or exit code, so the reader can tell success from failure.
- If an example cannot run on one of the supported platforms, say so in one line beside it.

## 7. Write links that name their target

- Use descriptive link text: "the contract schema reference", not "click here" or "this".
- Link to the file that owns the behaviour, such as `.agent/skills/write-handoff.md`, not to a copy of its text.
- Check that each relative link resolves to a file that exists before you commit.

## 8. Keep docs in the same commit as the code

- A change to behaviour and its docs land in one commit. A commit that changes behaviour without its docs is not done.
- Update the README when the change is user-facing. Add the `docs/<feature>.md` page when the feature needs more than a paragraph.
- Add a CHANGELOG entry for each version bump, with any breaking change first.

## 9. Delete stale text

- Read the existing section before you add to it. Find every sentence that the change makes false.
- Replace or delete the false sentence. Do not add a new sentence beside it that contradicts it.
- Remove a section whose feature was removed. Do not leave a note saying the feature "used to" exist, unless the CHANGELOG is the place for it.
- After editing, search the file for the old command name, the old path and the old flag, and fix every hit.

## 10. Check before you finish

- Run each example and confirm its output matches the page.
- Read the first sentence of each section. Does it answer the question the heading asks?
- Confirm that no file in the change says something the code does not do.
- Report what you verified, the commands you ran, and the gaps you did not close.

## Sources

- https://developers.google.com/style (the guide's own page; text licensed under CC BY 4.0, code samples under Apache 2.0, as stated on the page; read via Alembic). Distilled prose only: the reference hierarchy, active voice and second person, conditions before instructions, sentence case headings, descriptive links, and the rule that a deviation must be applied consistently.
- https://developers.google.com/style/highlights (same licence statement as above; read via Alembic). Distilled prose only: formatting of code, paths and UI text, and the list and sentence rules.
- Athanor's BLUF rule, stated in `CLAUDE.md` under section 3, rule 6 ("BLUF and bullets").

This skill is distilled prose written for Athanor. It is not a copy of any upstream file.
