# p1-p2-2-fix-dispatched-to-dev-opu5-m3-f4

**[P1+P2×2, fix dispatched to Dev_Opu5_M3-F4 2026-10-29] Codex round-2 FAIL on #160 @3ba9ffa0.** Evidence: .tmp/sandbox/codexqa/r160b.out. P1 buy-path-live-reads.mts:231 allowlist matches spelling not binding (shadowed param bypasses `live: true`). P2 verify_triad_coverage.py:67 misses WHATWG tab-strip (`saoc.\tco.za`). P2 groq-fingerprint.mjs:26 `qh=` spoofable from query text. Folded in: NOS Site's local-next-server.mjs:38 unquoted NODE_OPTIONS path (breaks on paths with spaces; CI unaffected). Merge only on CI green + Codex PASS.
