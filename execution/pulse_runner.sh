#!/bin/bash

# Prepend common paths for CLI tools (gh, jq)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Dynamic path resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Extract PROJECT_NAME from .agent/profile.json
PROJECT_NAME=$(jq -r '.project_name' "$PROJECT_ROOT/.agent/profile.json")
PROJECT_PREFIX="[${PROJECT_NAME}] "

# Source the .env file if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
  source "$PROJECT_ROOT/.env"
fi

# Export GITHUB_TOKEN if it's set
if [ -n "$GITHUB_TOKEN" ]; then
  export GITHUB_TOKEN
fi

LOG_FILE="$PROJECT_ROOT/pulse.log"

REGISTRY_DIR="$PROJECT_ROOT/.agent/pulse/registry"
INBOX_DIR="$PROJECT_ROOT/.agent/memory/project/inbox"

mkdir -p "$INBOX_DIR" # Ensure inbox exists

echo "${PROJECT_PREFIX}Starting Pulse runner..."

# Loop through each file in the registry directory
for script_path in "$REGISTRY_DIR"/*; do
  # Check if it's a file and executable
  if [ -f "$script_path" ] && [ -x "$script_path" ]; then
    script_name=$(basename "$script_path")
    timestamp=$(date +"%Y%m%d%H%M%S")
    # Using %.* to remove the extension from script_name for the output file
    output_file="$INBOX_DIR/${script_name%.*}-${timestamp}.txt" 

    echo "${PROJECT_PREFIX}Running $script_name..."
    # Execute the script and redirect its output to a file in the inbox
    if "$script_path" > "$output_file" 2>&1; then
      EXIT_CODE=0
      STATUS="SUCCESS"
      echo "${PROJECT_PREFIX}Output saved to $output_file"
    else
      EXIT_CODE=$?
      STATUS="FAILURE"
      echo "${PROJECT_PREFIX}Error running $script_name. Output and errors saved to $output_file"
    fi
    # Only try to get snippet if the file was created and is not empty
    if [ -s "$output_file" ]; then # -s checks if file exists and is not empty
      SNIPPET=$(head -n 1 "$output_file" | cut -c 1-80)
    else
      SNIPPET="(no output)"
    fi
    echo "${PROJECT_PREFIX}$timestamp | $script_name | $STATUS | $EXIT_CODE | $SNIPPET" >> "$LOG_FILE"
  elif [ -f "$script_path" ]; then
    echo "${PROJECT_PREFIX}Skipping $script_path: Not executable."
  fi
done

echo "${PROJECT_PREFIX}Running ingest_pulse.sh..."
"$SCRIPT_DIR/ingest_pulse.sh" "$PROJECT_NAME" # Pass PROJECT_NAME to ingest_pulse.sh

echo "${PROJECT_PREFIX}Pulse runner finished."
