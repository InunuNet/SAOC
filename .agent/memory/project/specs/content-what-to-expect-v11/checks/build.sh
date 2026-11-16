#!/usr/bin/env bash
# Production build for the content-what-to-expect-v11 rendered gate. Reuses the nos-content-standard build script (gate-origin
# site URLs, Sanity ids from apphosting.yaml) in LIVE mode: that spec's captured Sanity fixture predates current queries and
# misses, and this gate asserts copy plus the Day Pass row, which render from live Sanity reads (read-only).
set -euo pipefail
export NOS_STD_FIXTURE=live
exec bash .agent/memory/project/specs/nos-content-standard/checks/build.sh
