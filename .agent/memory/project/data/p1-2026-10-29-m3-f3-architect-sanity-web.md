# p1-2026-10-29-m3-f3-architect-sanity-web

[P1] (2026-10-29, M3/F3 architect) Sanity webhook unverified: docs/launch-checklist.md:126 names /api/sanity-revalidate but the route is app/api/revalidate. Our Editor token lacks sanity.project.webhooks/read (401), so whether a webhook exists and which URL it hits is unknown. Until confirmed, ISR stays at revalidate 60. Fix the doc path once the real webhook URL is known.
