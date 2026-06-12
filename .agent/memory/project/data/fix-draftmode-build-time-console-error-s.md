# fix-draftmode-build-time-console-error-s

**Fix `draftMode()` build-time console.error** — `sanityFetch` calls `draftMode()` unconditionally; throws (and is caught) outside request scope during `generateStaticParams`, emitting alarming CI log noise. Guard `draftMode()` behind a request-context check. Pre-existing A6 issue, flagged in B3.
