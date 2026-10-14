#!/bin/bash

# Dynamic path resolution for project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Extract PROJECT_NAME from .agent/profile.json
PROJECT_NAME=$(jq -r '.project_name' "$PROJECT_ROOT/.agent/profile.json")
PROJECT_PREFIX="[${PROJECT_NAME}] "

echo "${PROJECT_PREFIX}Starting auto_update.sh script..."

if [ "$PROJECT_NAME" == "Athanor" ]; then
  echo "${PROJECT_PREFIX}Project is Athanor, running 'make self-update'..."
  make self-update
  echo "${PROJECT_PREFIX}Finished 'make self-update'."
else
  echo "${PROJECT_PREFIX}Project is not Athanor, running 'make update-template'..."
  make update-template
  echo "${PROJECT_PREFIX}Finished 'make update-template'."
fi

echo "${PROJECT_PREFIX}auto_update.sh script finished."
