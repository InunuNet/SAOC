# p0-no-enforcement-for-the-never-cd-rule

**[P0] No enforcement for the "never cd" rule — agents keep prompting the operator**
  (2026-09-08, Brad raised it twice in one session, explicitly refusing to approve more).
  Agents open Bash blocks with `cd <project-root>`, which makes the following command's target
  statically unresolvable while a `Read()` deny rule is configured, forcing a manual approval
  modal that stalls the mission and everything queued behind it. The rule is ALREADY stated in
  `.claude/agents/<role>.md` (qa.md:47), `.claude/rules/sandbox.md`, and
  `.agent/rules/_core/sandbox.md` — three places — and 2 of 2 QA subagents violated it anyway.
  Prose is empirically insufficient; only a `PreToolUse(Bash)` hook would fix it.
  CANNOT BE FIXED LOCALLY: `check_autonomy.sh`'s `floor_glob_match()` protects `.claude/hooks/*`,
  `.claude/settings.json`, `CLAUDE.md` and `AGENTS.md`, so the guard can neither be written nor
  registered. Filed upstream: InunuNet/Athanor#1416.
  MITIGATION IN PLACE until upstream lands: (a) Rule Zero prepended to `.claude/rules/sandbox.md`;
  (b) every Agent dispatch brief must open with the prohibition — this is now mandatory practice,
  recorded in the brain. Blocked on: upstream.
