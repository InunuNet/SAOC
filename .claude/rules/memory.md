# Memory Usage Rules

## Before Starting Work
1. Run `python3 execution/brain.py last-session` — understand prior context
2. Read `.agent/memory/project/goals.md` — what are we trying to achieve
3. Read `.agent/memory/project/learned.md` — avoid known pitfalls

## During Work
- Log significant decisions to scratch: `.agent/memory/scratch/`
- For brain queries: `python3 execution/brain.py recall "topic" --n 3`

## After Work
- Claude Code: maintainer agent handles this automatically via SessionEnd hook
- Other tools: `python3 execution/brain.py wrap-up -s "summary" -t "tags"`
