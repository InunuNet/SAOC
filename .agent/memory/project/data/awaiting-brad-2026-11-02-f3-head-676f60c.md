# awaiting-brad-2026-11-02-f3-head-676f60c

**[awaiting Brad, 2026-11-02] F3 head 676f60c8 is only in the separate clone /Users/vetus/ai/SAOC NOS Site (30 commits unpushed).** This project may not read that clone without permission and pushing needs a go, so F8 (fix/go-live-f8) is built on the older origin F3 5679648d and must be rebased onto 676f60c8 after F3 is pushed. Deploying F8 needs H4 (confirm production X-Forwarded-For hop count) first, or all callers share one limiter bucket. tickets/checkout body read is already capped on the F3 head (route.ts:535 per NOS Site).
