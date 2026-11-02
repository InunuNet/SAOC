# 2026-10-28-gate-standard-d7-scroller-vs

(2026-10-28) **gate-standard D7 scroller vs 97px header at 768** — nos-content-standard gate-standard fails on main 63146ec5 at 768@2 on /plan-your-visit, /faq, /privacy, /terms, /refunds ("mid-page the scroller stays reachable… top 0, header bottom 97"). Pre-existing, not council-copy. council-copy-fixes A7 wraps it via gate-standard-known-defect.mjs (tolerates exactly these 5 lines). Fix the scroller/sticky-header geometry or the check, then drop the wrapper.
