#!/usr/bin/env bash
# nav-focus-underline -- browser_deployed_check for the NOS host. execution/browser_deployed_check.sh allowlists one origin
# (BROWSER_CHECK_DEPLOYED_ORIGIN, default https://beta.saoc.co.za); the NOS site is a second deployed origin
# (NEXT_PUBLIC_NOS_SITE_URL in apphosting.yaml). This wrapper only selects that origin; every other rule (hosted.app / run.app
# denylist, freshness, commit_sha, live re-fetch) is the harness script's, unchanged.
export BROWSER_CHECK_DEPLOYED_ORIGIN="https://nos.saoc.co.za"
exec execution/browser_deployed_check.sh "$@"
