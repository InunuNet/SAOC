# p3-a26-style-single-fetch-browser-deploy

**[P3] A26-style single-fetch `browser_deployed_check` assertions can flake** — add a
  retry or multi-sample. During `show-dates-23-26-sept-2027` M1/F2 (2026-10-06), A26 failed once
  then passed on an immediate re-run with no code change in between; likely a stale ISR render
  from App Hosting's per-instance cache rather than a real defect, but a single fetch can't tell
  the difference.
