#!/bin/bash

# Dynamic path resolution for project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Extract PROJECT_NAME from .agent/profile.json
PROJECT_NAME=$(jq -r '.project_name' "$PROJECT_ROOT/.agent/profile.json")
PROJECT_PREFIX="[${PROJECT_NAME}] "

echo "${PROJECT_PREFIX}Starting auto_update.sh script..."

# delivery-integrity F1: the updater exits non-zero on a PARTIAL delivery (paths
# withheld by the baseline guard, entries that raised, or a symlink refusal). This
# script runs unattended under Pulse, so its own exit code is the only thing that
# records the outcome — capture it and propagate it as the script's exit status.
# Previously the trailing `echo` was the last command, which meant the script
# always exited 0 and Pulse logged a partial delivery as a successful job: F1's
# false-success reconstituted one layer up, at the layer nobody is watching.
if [ "$PROJECT_NAME" == "Athanor" ]; then
  echo "${PROJECT_PREFIX}Project is Athanor, running 'make self-update'..."
  make self-update
  UPDATE_RC=$?
  UPDATE_TARGET="make self-update"
else
  echo "${PROJECT_PREFIX}Project is not Athanor, running 'make update-template'..."
  make update-template
  UPDATE_RC=$?
  UPDATE_TARGET="make update-template"
fi
echo "${PROJECT_PREFIX}Finished '${UPDATE_TARGET}' (exit ${UPDATE_RC})."

if [ "$UPDATE_RC" -ne 0 ]; then
  echo "${PROJECT_PREFIX}FAILED: '${UPDATE_TARGET}' exited ${UPDATE_RC} — the update did NOT fully land. Review the WITHHELD/REFUSED report above; DERIVED files were still regenerated." >&2
fi

echo "${PROJECT_PREFIX}auto_update.sh script finished (exit ${UPDATE_RC})."
exit "$UPDATE_RC"
