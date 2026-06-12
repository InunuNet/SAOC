#!/usr/bin/env bash
# verify_post_update_boot.sh
# Post-update boot guard: every hook script referenced in .claude/settings.json
# MUST exist on disk under execution/hooks/. Catches the content-delivery gap
# where make update-template rewrites settings.json with hook references that
# were never delivered (GitHub-fetch fallback to local template/).
#
# Exit 0 if all referenced hooks present. Exit 1 listing each missing hook.
#
# Env override (for testing): SETTINGS_PATH defaults to .claude/settings.json.

set -u

SETTINGS_PATH="${SETTINGS_PATH:-.claude/settings.json}"

if [ ! -f "$SETTINGS_PATH" ]; then
  echo "verify_post_update_boot: settings file not found: $SETTINGS_PATH" >&2
  exit 1
fi

# Extract every `bash execution/hooks/<name>.sh` reference from settings.json.
REFS=$(grep -oE 'execution/hooks/[A-Za-z0-9_]+\.sh' "$SETTINGS_PATH" | sort -u)

missing=0
for hook in $REFS; do
  if [ ! -f "$hook" ]; then
    echo "MISSING: $hook (referenced in $SETTINGS_PATH but not on disk)"
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "verify_post_update_boot: FAIL — one or more referenced hooks are missing" >&2
  exit 1
fi

echo "verify_post_update_boot: OK — all referenced hooks present"
exit 0
