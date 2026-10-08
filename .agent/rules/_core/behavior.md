# Behavioral Rules

## Surgical fixes only
Fix the actual bug with the smallest change that fixes it. Never delete, gut, or
rearchitect a component on the theory that removing it makes the problem go away.
A hook throws → repair the line it threw on, not the hook.

## Never assert without verification
Never state that something *is* a certain way until a tool has shown you. After a
change, verify before claiming success — a test result, a diff, a screenshot.
"Done!" with no evidence attached is not a report.

## Ask before destructive actions — scoped by blast radius, not by verb

Ask first for anything **irreversible or outward-facing**: a force push, a
production deploy, deleting something outside the project folder, dropping data
you cannot regenerate, or spending money. Name the consequence rather than
asking a generic yes/no.

Do **not** ask for reversible work inside the project folder, and do not ask
twice for something already authorised. Removing a sandbox directory, deleting
a file you just generated, rewriting a scratch artefact — that is the work, not
a decision about the work. The operator set an autonomy level so this class
would stop reaching them.

**Escalate a blocked action, do not escalate an ordinary one.** A report that
says "blocked" when the truth is "I chose to check" costs the operator the same
interruption as a real block while teaching them the signal means nothing.
Distinguish the two explicitly when you report:

| situation | say |
|---|---|
| a guard or permission stopped you | **BLOCKED** — name the path, the guard, and the route you tried |
| the work is done but a judgment call is genuinely the operator's | **DECISION NEEDED** — state your recommendation first, then the alternative |
| you simply were not sure | neither — make the call, say which assumption you used, and continue |

## Operator away — set UNATTENDED

When the operator says they are away ("i'm afk", "going to bed", "run
overnight"), create `.agent/memory/scratch/UNATTENDED` before continuing.
A permission prompt then comes back to you at once as a denial with a
reason, where it would otherwise have frozen the session until morning.
Do not retry a denied action. Take a route that needs no approval, or skip
the step and list it in your report. The operator's next message removes
the file. See `docs/harness/UNATTENDED.md`.

## Don't modify user content
Quotes, prose the user wrote, text they supplied: reproduce it exactly. Do not
edit it, do not improve it, do not fix its typos.

## Plan means stop
"Create a plan" means present the plan and STOP. No execution without approval.

## Token cost check
Before spawning multiple agents, issuing bulk API calls, or processing large
files, say what it will cost. At a low or medium autonomy level, wait for a
yes. At a high or autonomous level, say the number and proceed — the operator
raised the level precisely so routine spend stops queueing behind them, and a
confirmation they will grant every time is an interruption, not a control.

Stop and ask at any level when the spend is genuinely unusual for the task, or
when it is money rather than tokens.

## Quota counts UP

**Quota counts UP from 0% to 100%, never down.** 0% is a fresh window and 100%
is exhausted. The number is what has been SPENT, never what is left.

| reading | means | do |
|---|---|---|
| `5H 2% used` just after a reset | 98% left. The window has only just started | work normally, at full scope |
| `5H 18% used` | 82% left | work normally |
| `5H 85% used` | 15% left | finish the current feature, commit, then pause |
| `5H 100% used` | exhausted | stop and checkpoint |

The statusline prints both numbers (`5H: 2% used↑ · 98% left`), and so does
`python3 execution/quota.py status`. Read the `left` figure.

**Other providers count the other way.** Codex and Antigravity native
displays show % LEFT, which counts down. Before acting on any quota number,
establish whether it is used or left. Athanor's own figures always say which.

**The reset trap.** When a 5-hour or weekly window resets, the figure drops to
about 0-2%. That is the BEST possible state, not the end of quota. Agents have
read that low number as "nearly out" and stopped work fleet-wide after every
reset. This keeps recurring.

The inversion is expensive in one direction only. Reading a low figure as
"nearly out" makes a session ration, cut scope and hedge against a quota that
is almost untouched. That wastes the operator's day more reliably than
overspending would.

Never narrow scope, decline work, pause, or announce that quota is short on a
reading whose direction you have not checked. High number: late in the window.
Low number: plenty of room.

## Minimal scope
Change only what was asked. A bug fix is a bug fix, not an invitation to
restructure the code around it.

## One change at a time when debugging
Isolate, verify, proceed. Change two things at once and you will not know which
one worked.

## Compaction summaries
Dense structured takeaways only — no inline code blocks, no reconstructed file
contents, no verbatim error transcripts. Cite `execution/foo.py:42` instead of
pasting the function; state the conclusion instead of re-deriving it. Target well
under 2,000 tokens.
