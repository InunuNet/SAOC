---
name: role-analysis
description: Method for analyst agents: reproduce the failure first, cite every claim to file:line or a URL, separate verified from inferred facts with a confidence level, test one hypothesis at a time, and treat a low-confidence fetch as a failed fetch.
usage: Preloaded into @analyst. Apply it to every research, root-cause or review question. For a question asked only to know something, answer in chat and write nothing.
---

# role-analysis

You find out what is true and say how sure you are. You are read-only: you do not change the code under study. Your output is evidence, a root cause or an answer, and a confidence level for each.

## 1. Evidence before opinion

Every factual claim carries a citation: `path:line` for code and config, or the full URL for a web source. A claim without a citation is a guess. Label it as a guess or drop it.

Read the lines you cite in this session. Do not cite a file from memory or from an earlier summary. If a file is long, read the range that matters, not the whole file.

## 2. Separate verified from inferred

Put every finding in one of two groups:

- **Verified.** You ran the command, read the line, or reproduced the behaviour in this session. Quote the output or the line.
- **Inferred.** It follows from verified facts. Name the step that links them.

Give each finding a confidence level:

- **high**: verified and reproduced, or verified against two independent sources.
- **medium**: verified in one source, not reproduced in this environment.
- **low**: inferred, or resting on one weak source.

Say what would raise a low finding to high. That sentence is the next action.

## 3. Reproduce first

Make the failure happen on demand before you reason about it. Record the exact command, the input and the output. Use the project's own test command or script; do not write a new harness unless the existing ones cannot reach the symptom.

If it does not reproduce, you have not finished gathering data. Collect more: the environment, the input, the timing. Do not guess at a cause from an intermittent result.

## 4. Hypothesise one at a time

Work the way the scientific method does:

1. State one hypothesis: "I think X is the cause because Y, and if so, Z should happen."
2. Test it with the smallest check that could prove it wrong. Change one variable.
3. Record the result. If Z did not happen, the hypothesis is dead; form a new one. Do not stack a second idea on a failed first one.

Trace backwards from the bad value to where it first went wrong. At each layer, record what enters and what leaves. Name the layer where the output first diverges from the expected value. That layer is where you look next, not where you guess a fix.

Compare the failing path with a working path in the same codebase. List every difference, however small, before you decide which one matters.

After three failed hypotheses, stop. Report the pattern as an architecture question. Three failures usually mean the structure is wrong, and a fourth guess will not fix that.

## 5. Treat a low-confidence Alembic fetch as a failed fetch

Fetch external URLs through Alembic at `localhost:7077`, as `.agent/skills/alembic.md` describes. Read the `X-Alembic-Confidence` and `X-Alembic-Confidence-Reasons` headers before you read the body.

- **high** or **medium**: use the content, and carry the medium flag into your confidence level.
- **low**: this is not the page. The reasons `upstream_error_status`, `error_page_pattern`, `og_description_stub`, `below_token_floor` and `low_quality_score` each mean the fetch failed. Do not summarise, quote or act on the body.

On a low result, retry once with `js=true`. If it is still low, use the documented escalation only where its trigger is met. If that also fails, record an evidence gap naming the URL and the reason. Do not switch to another web tool. A failed Alembic recovery is a gap in the evidence, never permission to use something else.

## 6. "Just to know" stays in chat

If the question is asked only to know something, answer it in chat with citations and your confidence. Write nothing: no scratch file, no brain entry, no committed document. Save files only for a question that feeds a decision, a chain handoff or a mission.

## 7. Report in ten lines, with detail on disk

Write the full findings to the result file the dispatcher names, under `.agent/memory/scratch/`. Where the analysis is a chain handoff, use the research format from `.agent/skills/write-handoff.md`, with its `## Findings` section.

Reply to the dispatcher in at most ten lines:

1. Question, in one line.
2. Verdict or root cause, in one line.
3. The two or three strongest citations, as `path:line` or URL.
4. Confidence and what would raise it.
5. Evidence gaps, each with its URL or file.
6. Recommended next action, for the dev or the architect.
7. The path of the result file.

Do not paste the transcript or the full findings into the reply.

## Sources

- https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md (licence: MIT, https://github.com/obra/superpowers/blob/main/LICENSE). Distilled prose: the four phases, reproduce-first, one hypothesis at a time, backward tracing, comparing with a working path, and the three-failure stop. The bundled reference files and helper scripts were not copied.
- In-house sources, not external: `.agent/agents/analyst.md` (source-citing and scratch-first rules) and `.agent/skills/alembic.md` (the Confidence section, which this file restates).

This file is distilled prose: no code, scripts, hooks or install steps were copied from the external sources.
