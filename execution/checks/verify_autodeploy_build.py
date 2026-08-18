#!/usr/bin/env python3
"""
verify_autodeploy_build.py — proves that a SPECIFIC pinned commit's push produced an
AUTOMATIC (push-triggered) Cloud Build for the App Hosting backend `saoc-prod` that
reached SUCCESS, and that build was served by the backend at some point in its
rollout history.

Why pinned-commit, not "most recent automatic build" (rework, superseding the
--since-commit design): App Hosting rolls out one build at a time (~5-18 minutes) and
commits land faster than that, so "the most recent automatic build is what's currently
served" is structurally false on a HEALTHY pipeline for as long as anyone keeps
committing after the commit under test. Two live runs against the old design produced
false negatives for exactly this reason (proof build 028 vs. serving 026, then proof
029 vs. serving 027) — the pipeline was fine both times; the check was measuring a
liveness race, not a defect. The property F1 actually needs proven is historical and
monotonic: "this commit's push produced an automatic build that succeeded, and that
build was served at some point." Once true, it stays true regardless of what ships
after it — a later commit's build superseding it in the rollout history is expected
and healthy, not a failure.

Why this exists (see .agent/memory/project/specs/prove-ticket-purchase-works-end-
to-end-b/goldens/f1-deploy-health.golden.md): commit 0c577dc fixed the tsconfig
bug that was silently breaking every auto-deploy since the self-signup Cloud
Function was added. That fix EXPLAINS the prior failures but does not itself
PROVE that push produced a successful, auto-triggered deploy that was actually
served. "The tsconfig is fixed" and "a real push-triggered build for that commit
succeeded and was live at some point" are different claims — this script checks
the second one against real GCP state, not against source code.

Auth: this environment has no local `gcloud` credentials (`gcloud auth list`
shows none), but the Firebase CLI (`firebase login:list`) is authenticated as a
real user. Firebase CLI's OAuth refresh token is cached at
~/.config/configstore/firebase-tools.json and was issued against firebase-tools'
own OAuth client (CLIENT_ID/CLIENT_SECRET below are the long-published, non-
secret installed-app client id/secret firebase-tools itself ships in its open
source — see https://github.com/firebase/firebase-tools/blob/master/src/apiv2.ts
and related auth modules; they identify the app, not a user, and are safe to
embed the same way firebase-tools does). This script exchanges that refresh
token for a short-lived access token scoped to `cloud-platform`/`firebase` (the
same scopes firebase-tools itself requested at login) and uses it to call the
Cloud Build REST API and the Firebase App Hosting REST API directly — no gcloud
install/auth required.

Method:
  1. Resolve the GCP project id from .firebaserc, and the App Hosting backend id
     + region by parsing the backend's URL out of apphosting.yaml (e.g.
     "saoc-prod--saoc-webapp.europe-west4.hosted.app" -> backend=saoc-prod,
     region=europe-west4).
  2. Resolve --commit to a full 40-hex SHA via the LOCAL git repo (`git rev-parse`).
     Also check whether that SHA is reachable from any local remote-tracking branch
     (`git branch -r --contains`) — this distinguishes a genuinely pushed commit that
     simply never got an automatic build (a real gap) from a SHA that was rewritten
     away (e.g. by a squash/rebase before push) and was never pushed at all under
     that identity, so a red result always states which case it is rather than
     asserting "genuine gap" on a SHA that may never have existed on the remote.
  3. Mint an access token from the cached firebase-tools refresh token.
  4. List Cloud Build builds for that region
     (cloudbuild.googleapis.com/v1/.../locations/<region>/builds). App Hosting
     tags every build it creates with the backend id (e.g. "saoc-prod"), the
     literal "fah" tag, and the full 40-hex-char commit SHA it built. Automatic
     (push-triggered) builds get a displayName/tag of the form
     "build-YYYY-MM-DD-NNN"; manually-triggered builds (`firebase
     apphosting:rollouts:create`) get "build-manual-<epoch>" instead — this is
     the actual, observed distinguishing signal between the two trigger types
     (there is no separate "trigger type" field on the build resource itself).
  5. Among automatic builds (is_automatic_build) whose commit SHA tag EXACTLY equals
     the resolved --commit SHA (a pin, not a lower bound — a later commit's build no
     longer counts as proof for an earlier one), pick the one with status SUCCESS if
     any; otherwise the most recently created one (covers retried builds for the same
     commit, e.g. a transient infra failure followed by a manual re-trigger of the
     same SHA).
  6. Tri-state on that build's status:
       - SUCCESS: proceed to the serving check.
       - WORKING / QUEUED: the build for this commit is still in flight. This is not
         a defect finding — print PENDING and exit 2 (not-yet-decidable), the same
         exit code this script already reserves for "cannot decide, try again",
         never exit 1.
       - anything else terminal (FAILURE, TIMEOUT, CANCELLED, INTERNAL_ERROR,
         EXPIRED, or an unrecognized status) is a real FAIL.
  7. Confirm the backend served THAT SPECIFIC build at some point: list ALL of the
     backend's rollouts (firebaseapphosting.googleapis.com, fully paginated), and
     check whether ANY state=SUCCEEDED rollout's `build` field resolves — by
     build-id-tag identity, the same identifier Cloud Build and the App Hosting
     Build resource both carry — to the exact proof build selected in step 5. The
     FIRST identity match found is sufficient; there is no time-ordering
     requirement and no "must be the CURRENTLY served build" requirement. Being
     superseded by a later commit's rollout afterwards is expected, healthy
     behavior on an actively-developed pipeline, not something this script treats
     as a failure. Build-id identity (not commit-descendant membership) is used
     for the same reason the prior design used it: a MANUAL rollout of some other
     commit would pass a membership test but must not pass an identity test, since
     it would mean the property being proven — "push alone got this build live" —
     isn't actually true.

Usage:
  python3 execution/checks/verify_autodeploy_build.py --commit 0c577dc

Exit codes:
  0 = an automatic build for EXACTLY --commit reached SUCCESS, and some SUCCEEDED
      rollout in the backend's full history resolves to that exact build by
      build-id identity.
  1 = a real, decided FAIL: no automatic build for exactly --commit exists at all
      (see the printed message for whether that commit is confirmed reachable from
      a local remote-tracking branch, i.e. genuinely pushed), the matched build's
      status is a terminal non-SUCCESS state, the backend has no SUCCEEDED rollout
      at all, or no SUCCEEDED rollout in the backend's full history is
      identity-tied to the proof build.
  2 = not yet decidable, or a setup/auth failure unrelated to the defect under
      test: PENDING (the matched build for --commit is still WORKING/QUEUED — try
      again later, this is not a failure), missing refresh token, token exchange
      failure, unresolvable project/backend config, unreachable API, or --commit
      does not resolve in local git at all.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
FIREBASERC = REPO_ROOT / ".firebaserc"
APPHOSTING_YAML = REPO_ROOT / "apphosting.yaml"
FIREBASE_TOOLS_CONFIGSTORE = Path.home() / ".config" / "configstore" / "firebase-tools.json"

# firebase-tools' own published OAuth installed-app client id/secret — identifies
# the CLI application, not a user or a project secret. Firebase-tools ships these
# in its own open source distribution.
FIREBASE_TOOLS_CLIENT_ID = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
FIREBASE_TOOLS_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"

COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
BACKEND_URL_RE = re.compile(r"([a-z0-9-]+)--[a-z0-9-]+\.([a-z0-9-]+)\.hosted\.app")
# The App Hosting build-id tag Cloud Build carries for every build it creates on
# behalf of a backend: "build-YYYY-MM-DD-NNN" for automatic (push-triggered)
# builds, "build-manual-<epoch>" for manually-triggered ones. This same string is
# also the terminal path segment of the App Hosting Build resource name a rollout
# points to (projects/.../backends/<backend>/builds/<this-id>) — it is the one
# identifier shared by both APIs, which is what lets us tie a specific rollout
# back to a specific Cloud Build by identity instead of by commit-descendant
# membership (a test a manual rollout of a later commit would also pass).
BUILD_ID_TAG_RE = re.compile(r"^build-(?:manual-\d+|\d{4}-\d{2}-\d{2}-\d+)$")

PENDING_STATUSES = {"WORKING", "QUEUED"}


def fail_setup(message: str) -> int:
    print(f"SETUP FAILURE: {message}", file=sys.stderr)
    return 2


def resolve_project_id() -> str | None:
    if not FIREBASERC.exists():
        return None
    data = json.loads(FIREBASERC.read_text())
    return data.get("projects", {}).get("default")


def resolve_backend_and_region() -> tuple[str, str] | None:
    if not APPHOSTING_YAML.exists():
        return None
    text = APPHOSTING_YAML.read_text()
    match = BACKEND_URL_RE.search(text)
    if not match:
        return None
    return match.group(1), match.group(2)


def get_access_token() -> str | None:
    if not FIREBASE_TOOLS_CONFIGSTORE.exists():
        return None
    config = json.loads(FIREBASE_TOOLS_CONFIGSTORE.read_text())
    refresh_token = config.get("tokens", {}).get("refresh_token")
    if not refresh_token:
        return None

    body = urllib.parse.urlencode({
        "client_id": FIREBASE_TOOLS_CLIENT_ID,
        "client_secret": FIREBASE_TOOLS_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode()

    request = urllib.request.Request(
        "https://oauth2.googleapis.com/token", data=body, method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            payload = json.loads(response.read())
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        print(f"token refresh failed: {exc}", file=sys.stderr)
        return None
    return payload.get("access_token")


def api_get(url: str, token: str, params: dict | None = None) -> dict:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())


def list_all_pages(url: str, token: str, params: dict, list_key: str) -> list[dict]:
    """Follow nextPageToken until exhausted. Without this, any list past the
    first page silently drops items — a qualifying build/rollout on a later
    page would never be seen, producing a false FAIL (or, for rollouts, a
    verdict based on an incomplete view of what was ever served)."""
    items: list[dict] = []
    page_token: str | None = None
    while True:
        query = dict(params)
        if page_token:
            query["pageToken"] = page_token
        data = api_get(url, token, query)
        items.extend(data.get(list_key, []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return items


def list_cloud_builds(project_id: str, region: str, token: str) -> list[dict]:
    url = (
        f"https://cloudbuild.googleapis.com/v1/projects/{project_id}"
        f"/locations/{region}/builds"
    )
    return list_all_pages(url, token, {"pageSize": 100}, "builds")


def list_rollouts(project_id: str, region: str, backend: str, token: str) -> list[dict]:
    url = (
        f"https://firebaseapphosting.googleapis.com/v1/projects/{project_id}"
        f"/locations/{region}/backends/{backend}/rollouts"
    )
    return list_all_pages(url, token, {"pageSize": 200}, "rollouts")


def get_apphosting_build(build_resource_name: str, token: str) -> dict:
    """Fetch the App Hosting Build resource (projects.locations.backends.builds)
    that a rollout's `build` field names. This is a different resource from a
    Cloud Build `Build` — it carries the resolved source commit directly at
    `source.codebase.hash`, used only for the confirmatory print once a serving
    match has already been established by build-id identity."""
    url = f"https://firebaseapphosting.googleapis.com/v1/{build_resource_name}"
    return api_get(url, token)


def extract_apphosting_build_commit(build: dict) -> str | None:
    commit_hash = build.get("source", {}).get("codebase", {}).get("hash")
    if commit_hash and COMMIT_SHA_RE.match(commit_hash):
        return commit_hash
    return None


def is_automatic_build(build: dict, backend: str) -> bool:
    tags = build.get("tags", [])
    if backend not in tags or "fah" not in tags:
        return False
    return not any(tag.startswith("build-manual-") for tag in tags)


def extract_commit_sha(build: dict) -> str | None:
    for tag in build.get("tags", []):
        if COMMIT_SHA_RE.match(tag):
            return tag
    return None


def extract_build_id_tag(build: dict) -> str | None:
    """The App Hosting build-id tag ("build-YYYY-MM-DD-NNN" or
    "build-manual-<epoch>") — the identifier shared with the App Hosting Build
    resource name a rollout points to. Used to tie a served rollout back to a
    specific Cloud Build by identity, not by commit-descendant membership."""
    for tag in build.get("tags", []):
        if BUILD_ID_TAG_RE.match(tag):
            return tag
    return None


def rollout_build_id_tag(rollout: dict) -> str | None:
    """The build-id tag a rollout's `build` field resolves to, read straight off the
    resource name's terminal path segment — no App Hosting Build fetch required,
    since identity is decided by this string alone."""
    build_name = rollout.get("build")
    if not build_name:
        return None
    tag = build_name.rstrip("/").rsplit("/", 1)[-1]
    return tag if BUILD_ID_TAG_RE.match(tag) else None


def resolve_full_commit(commit: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "rev-parse", commit],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def commit_reachable_from_remote(commit_full: str) -> bool:
    """True if --commit is reachable from any locally-known remote-tracking branch —
    i.e. it is confirmed to be a real, pushed commit, not just a SHA that happens to
    exist somewhere in local git history (e.g. an abandoned local commit, or one whose
    identity changed under a squash/rebase before it was ever pushed). This is a
    LOCAL check: it does not fetch, so a stale remote-tracking ref can under-report a
    commit that WAS pushed since the last fetch — the caller must state that caveat
    rather than treating a negative result here as certain proof the commit was never
    pushed.
    """
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "branch", "-r", "--contains", commit_full],
        capture_output=True, text=True,
    )
    if result.returncode != 0:
        return False
    return bool(result.stdout.strip())


def find_pinned_automatic_build(
    builds: list[dict], backend: str, commit_full: str,
) -> dict | None:
    """Return the automatic build for this backend whose commit SHA tag EXACTLY
    equals `commit_full` — a pin, not a lower bound. If more than one matches (a
    retried build for the same commit), prefer one with status SUCCESS; otherwise
    the most recently created one.
    """
    candidates = [
        build for build in builds
        if is_automatic_build(build, backend) and extract_commit_sha(build) == commit_full
    ]
    if not candidates:
        return None
    succeeded = [b for b in candidates if b.get("status") == "SUCCESS"]
    pool = succeeded if succeeded else candidates
    pool.sort(key=lambda b: b.get("createTime", ""))
    return pool[-1]


def find_serving_rollout(rollouts: list[dict], build_id_tag: str) -> dict | None:
    """Return the first SUCCEEDED rollout (any point in the backend's full rollout
    history, no time-ordering requirement) whose `build` resolves by build-id-tag
    identity to `build_id_tag`. Being superseded later by a newer commit's rollout
    does not disqualify a match — this checks "was ever served", not "is currently
    served".
    """
    for rollout in rollouts:
        if rollout.get("state") != "SUCCEEDED":
            continue
        if rollout_build_id_tag(rollout) == build_id_tag:
            return rollout
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--commit", required=True,
        help="commit SHA (full or abbreviated) — an EXACT pin, not a lower bound",
    )
    args = parser.parse_args()

    project_id = resolve_project_id()
    if not project_id:
        return fail_setup(f"could not resolve GCP project id from {FIREBASERC}")

    backend_region = resolve_backend_and_region()
    if not backend_region:
        return fail_setup(f"could not resolve backend/region from {APPHOSTING_YAML}")
    backend, region = backend_region

    commit_full = resolve_full_commit(args.commit)
    if not commit_full:
        return fail_setup(f"--commit {args.commit!r} does not resolve in local git")

    token = get_access_token()
    if not token:
        return fail_setup(
            "could not obtain an access token from the cached firebase-tools "
            f"refresh token at {FIREBASE_TOOLS_CONFIGSTORE} — run `firebase login` first"
        )

    try:
        builds = list_cloud_builds(project_id, region, token)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return fail_setup(f"Cloud Build API call failed: {exc}")

    build = find_pinned_automatic_build(builds, backend, commit_full)
    if build is None:
        pushed = commit_reachable_from_remote(commit_full)
        if pushed:
            print(
                f"FAIL: commit {commit_full} is reachable from a local remote-tracking "
                "branch (confirmed pushed), but no automatic (push-triggered) Cloud Build "
                f"for backend {backend!r} in {region!r} carries that exact commit SHA tag "
                f"(checked {len(builds)} builds) — this commit's push never produced an "
                "automatic build at all. This is a genuine gap, not a stale-lookup artifact."
            )
        else:
            print(
                f"FAIL: no automatic (push-triggered) Cloud Build for backend {backend!r} in "
                f"{region!r} carries commit SHA {commit_full} (checked {len(builds)} builds), "
                "AND that commit is NOT reachable from any local remote-tracking branch. This "
                "does not confirm the commit was never pushed — remote-tracking refs are only "
                "as fresh as the last local `git fetch` — but it means this script cannot "
                "distinguish 'genuinely never built' from 'this SHA was rewritten away by a "
                "squash/rebase before push and never existed under this identity on the "
                "remote'. Run `git fetch` and re-run before treating this as a confirmed gap."
            )
        return 1

    build_status = build.get("status")
    commit_sha = extract_commit_sha(build)
    build_id = build.get("id")

    if build_status in PENDING_STATUSES:
        print(
            f"PENDING: the automatic (push-triggered) Cloud Build for backend {backend!r} at "
            f"commit {commit_sha} is id={build_id} status={build_status!r} — still in flight, "
            "not yet decidable. This is not a failure; re-run once the build reaches a "
            "terminal status."
        )
        return 2

    if build_status != "SUCCESS":
        create_time = build.get("createTime")
        print(
            f"FAIL: the automatic (push-triggered) Cloud Build for backend {backend!r} at "
            f"commit {commit_sha} is id={build_id} createTime={create_time} "
            f"status={build_status!r} — a terminal non-SUCCESS state. This commit's push "
            "produced an automatic build, but it did not succeed."
        )
        return 1

    build_id_tag = extract_build_id_tag(build)
    if not build_id_tag:
        return fail_setup(
            f"proof build id={build_id} has no recognizable build-id tag "
            f"(tags={build.get('tags')}) — cannot identity-tie a served rollout to it"
        )

    finish_time = build.get("finishTime")
    print(
        f"PROOF BUILD (automatic build pinned to commit {commit_sha}): "
        f"id={build_id} build_id_tag={build_id_tag} finishTime={finish_time} status=SUCCESS"
    )

    try:
        rollouts = list_rollouts(project_id, region, backend, token)
    except (urllib.error.URLError, urllib.error.HTTPError) as exc:
        return fail_setup(f"App Hosting rollouts API call failed: {exc}")

    if not rollouts:
        print(f"FAIL: backend {backend!r} has no rollouts at all")
        return 1

    matched_rollout = find_serving_rollout(rollouts, build_id_tag)
    if matched_rollout is None:
        succeeded_count = sum(1 for r in rollouts if r.get("state") == "SUCCEEDED")
        print(
            f"FAIL: checked {succeeded_count} SUCCEEDED rollout(s) out of {len(rollouts)} total "
            f"for backend {backend!r} — none resolves by build-id identity to the proof build "
            f"({build_id_tag}, commit {commit_sha}). This build was never served, at any point "
            "in the backend's rollout history."
        )
        return 1

    matched_name = matched_rollout.get("name", "").split("/")[-1]
    matched_time = matched_rollout.get("updateTime")

    # Confirmatory only — identity via build_id_tag has already decided the result;
    # this fetch just surfaces the served commit in the success message. A failure
    # here is a setup problem (the API call itself), not a re-litigation of the
    # already-decided pass.
    served_commit = None
    served_build_name = matched_rollout.get("build")
    if served_build_name:
        try:
            served_build = get_apphosting_build(served_build_name, token)
            served_commit = extract_apphosting_build_commit(served_build)
        except (urllib.error.URLError, urllib.error.HTTPError) as exc:
            return fail_setup(f"App Hosting build lookup for {served_build_name!r} failed: {exc}")

    print(
        f"OK: automatic build {build_id} (build_id_tag={build_id_tag}, commit {commit_sha}) "
        f"reached SUCCESS at {finish_time}, and rollout {matched_name!r} "
        f"(completedAt={matched_time}, served commit={served_commit}) proves backend "
        f"{backend!r} served that exact build at some point in its rollout history — proven "
        "by build-id identity, historical (not 'currently served')."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
