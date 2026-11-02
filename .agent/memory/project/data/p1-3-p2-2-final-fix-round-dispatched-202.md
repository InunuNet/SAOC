# p1-3-p2-2-final-fix-round-dispatched-202

**[P1×3+P2×2, final fix round dispatched 2026-10-29] Codex r2 FAIL on #164 @27cd9738.** Evidence: .tmp/sandbox/codexqa/r164b.out. Symlinked _opt escapes the prune containment; prune runs before the manifest write; stale-lock takeover race; no fsync; PID reuse. A narrow Codex verify follows.
