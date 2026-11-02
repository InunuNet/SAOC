# p1-2026-10-29-filed-upstream-as-athanor

[P1] (2026-10-29, filed upstream as Athanor#1474) contract.py codex_qa wrapper errors show only the Codex session header, because the evidence keeps the head of the output and the reason (e.g. usage limit) is printed last. SAOC's pinned copy keeps 500 chars (contract.py:408). The 200 s supervisory default is shorter than codex_qa.sh's 1200 s. Workaround: set timeout_seconds 1300 on codex_qa assertions, and run execution/codex_qa.sh directly to see the reason.
