# p1-fix-dispatched-2026-10-29-codex-r3-on

**[P1, fix dispatched 2026-10-29] Codex r3 on #163 @b1f8102d: 1 finding left.** verify-pins.mjs:13 doesn't inspect contract commands, so A1 can be repointed to an unpinned script outside checks/. Fix: pin every executed script plus contract.yaml itself. Evidence: .tmp/sandbox/codexqa/r163c.out. A narrow Codex verify follows; then merge.
