#!/usr/bin/env bash
# build_isolated.sh — run a build command with .env.local hermetically absent and
# ONLY apphosting.yaml's current BUILD-availability variables present.
#
# This is the assertion that would have caught the silent two-week deploy outage:
# .env.local supplies FIREBASE_ADMIN_* locally, masking that the App Hosting
# builder never has them (they're RUNTIME-only in apphosting.yaml, by design —
# see the SITE_URL comment block and A-guard assertions for why that must stay
# true). Every local `pnpm build` before this contract read .env.local and so
# could never observe what the real builder observes.
#
# SAFETY CONTRACT (non-negotiable — read before touching this file):
#   .env.local is moved aside, never deleted, and restored on every exit path
#   (success, failure, or signal) via an EXIT trap. The restore is verified
#   byte-identical against a checksum taken before the move. A checksum mismatch
#   is treated as more severe than any build failure and is the loudest possible
#   failure this script can produce (exit 99), because leaving a developer's
#   .env.local missing or corrupted is a worse bug than the one this script
#   exists to catch. The cleanup function is idempotent (CLEANUP_DONE guard) —
#   trapping both a signal (INT/TERM) and EXIT means a killed run invokes
#   cleanup twice (once for the signal, once for the `exit` the handler itself
#   issues); without the guard the second call would find the backup already
#   restored and misreport it as a missing-backup CRITICAL.
#
# Usage:
#   build_isolated.sh [APPHOSTING_YAML] [-- BUILD_CMD...]
#   Defaults: APPHOSTING_YAML=./apphosting.yaml   BUILD_CMD="pnpm build"
#
# The BUILD_CMD override exists ONLY so selftest.py can exercise the backup/
# restore/trap machinery against a fast fake command in an isolated sandbox
# directory — see selftest.py "fake build" fixtures. The real contract
# assertion (A2 in contract-build-without-secrets.yaml) always uses the default.

set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

APPHOSTING_YAML="${1:-./apphosting.yaml}"
shift || true
if [ "${1:-}" = "--" ]; then
  shift
  BUILD_CMD=("$@")
else
  BUILD_CMD=(pnpm build)
fi

ENV_FILE=".env.local"
# Ends in .local so .gitignore's existing `.env*.local` rule covers it even if
# cleanup never runs (belt-and-braces — the trap is still the real guarantee).
BACKUP=".env.contract-backup.$$.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "build_isolated.sh: no $ENV_FILE present in $(pwd) — nothing to protect, proceeding without it"
  ORIG_SHA=""
  HAD_ENV_FILE=0
else
  ORIG_SHA="$(shasum -a 256 "$ENV_FILE" | awk '{print $1}')"
  HAD_ENV_FILE=1
fi

RESTORE_STATUS=0
CLEANUP_DONE=0
cleanup() {
  local build_rc=$?
  if [ "$CLEANUP_DONE" -eq 1 ]; then
    return
  fi
  CLEANUP_DONE=1
  if [ "$HAD_ENV_FILE" -eq 1 ]; then
    if [ ! -f "$BACKUP" ]; then
      echo "CRITICAL: backup $BACKUP is missing — cannot restore $ENV_FILE. This should be impossible; investigate immediately." >&2
      RESTORE_STATUS=99
    else
      mv -f "$BACKUP" "$ENV_FILE"
      NEW_SHA="$(shasum -a 256 "$ENV_FILE" | awk '{print $1}')"
      if [ "$NEW_SHA" != "$ORIG_SHA" ]; then
        echo "CRITICAL: $ENV_FILE restored but is NOT byte-identical (expected $ORIG_SHA, got $NEW_SHA)" >&2
        RESTORE_STATUS=99
      else
        echo "RESTORE-OK: $ENV_FILE restored, byte-identical to pre-build checksum"
      fi
    fi
  fi
  if [ "$RESTORE_STATUS" -ne 0 ]; then
    exit "$RESTORE_STATUS"
  fi
  exit "$build_rc"
}
trap cleanup EXIT INT TERM

if [ "$HAD_ENV_FILE" -eq 1 ]; then
  mv "$ENV_FILE" "$BACKUP"
fi

BUILD_VARS_FILE="$(mktemp)"
if ! python3 "$HERE/extract_build_vars.py" "$APPHOSTING_YAML" > "$BUILD_VARS_FILE"; then
  echo "build_isolated.sh: extract_build_vars.py failed — aborting before touching env" >&2
  rm -f "$BUILD_VARS_FILE"
  exit 1
fi

# env -i: start from a genuinely empty environment (not just an unset .env.local)
# so nothing in the calling shell's own env can smuggle a credential in — the
# builder's environment is exactly PATH + HOME + BUILD vars, nothing else.
env -i PATH="$PATH" HOME="$HOME" NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1 \
  $(cat "$BUILD_VARS_FILE" | tr '\n' ' ') \
  "${BUILD_CMD[@]}"
rc=$?
rm -f "$BUILD_VARS_FILE"
exit "$rc"
