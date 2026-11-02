# p3-ops-codex-usage-limit-reached-at-05-4

**[P3, ops] Codex usage limit reached at 05:41 SAST on 2026-10-29; it resets at 10:02.** The cross-vendor QA for #162 ran as a fallback @qa persona (workflow.md fallback, labelled in .agent/memory/scratch/qa-report-pr162.md). Queued Codex runs fire at 10:07 (session cron 856d32d6): #162 confirmation, the #160 re-fix, and F1c. If the session dies before then, re-run them by hand. Prompts are in .tmp/sandbox/codexqa/. Note: codex_qa.sh takes the prompt on stdin or as a positional argument. There is no --prompt-file flag.
