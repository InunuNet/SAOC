# 2026-10-28-retire-or-rewrite-nos-critiqu

(2026-10-28) **Retire or rewrite nos-critique-r12 `f6-rendered`** — dead on main: requests /national-show on the default host, which the NOS split retired (308 to nos). council-copy-fixes A9 now uses check-f6-baseline-copy.mjs instead. Point it at the NOS host or retire it. — 2026-11-14: retired in PR #187 (chore/f6-rendered-retire, 106c162e, Codex PASS), awaiting merge. Gap left: the 40px section-gap geometry is unguarded; re-guarding needs a NOS-host baseline recapture.
