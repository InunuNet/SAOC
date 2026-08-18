#!/bin/bash

# Dynamic path resolution for project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Extract PROJECT_NAME from .agent/profile.json
PROJECT_NAME=$(jq -r '.project_name' "$PROJECT_ROOT/.agent/profile.json")
PROJECT_PREFIX="[${PROJECT_NAME}] "

# Define directory for tracking issues currently being processed
PROCESSING_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
mkdir -p "$PROCESSING_DIR" || { echo "${PROJECT_PREFIX}Failed to create processing directory '$PROCESSING_DIR'. Exiting."; exit 1; }

MAX_PARALLEL_FIXES=1
declare -a CURRENTLY_RUNNING_PIDS # Array to store PIDs of gemini processes actively managed for parallel limits
declare -a ALL_GEMINI_PIDS        # Array to store ALL gemini PIDs started by this script

echo "${PROJECT_PREFIX}Starting auto_fix_issues.sh script..."
echo "${PROJECT_PREFIX}Fetching up to 50 open issues from InunuNet/Athanor..."

# Fetch all open issues from the repository
ISSUES_JSON=$(gh issue list --repo InunuNet/Athanor --limit 50 --state open --json number,title 2>/dev/null)

# Check if gh command was successful and returned valid JSON
if [ $? -ne 0 ]; then
    echo "${PROJECT_PREFIX}Error fetching issues from GitHub. Please ensure 'gh' CLI is installed and authenticated. Exiting."
    exit 1
fi

# Check if there are any issues returned
if [ "$(echo "$ISSUES_JSON" | jq 'length')" -eq 0 ]; then
    echo "${PROJECT_PREFIX}No open issues found in InunuNet/Athanor to process. Exiting."
    exit 0
fi

# Parse issues and process them using process substitution so the while loop runs in the current shell
while IFS=$'\n' read -r ISSUE_ID && read -r ISSUE_TITLE; do
    # Check if issue is already being processed locally
    if [ -f "$PROCESSING_DIR/$ISSUE_ID.lock" ]; then
        echo "${PROJECT_PREFIX}Issue #$ISSUE_ID (Title: '$ISSUE_TITLE') is already being processed (lock file exists). Skipping."
        continue
    fi

    echo "${PROJECT_PREFIX}Queueing autonomous fix for Issue #$ISSUE_ID (Title: '$ISSUE_TITLE')"

    # Create a lock file to mark the issue as in-progress
    touch "$PROCESSING_DIR/$ISSUE_ID.lock" || { echo "${PROJECT_PREFIX}Failed to create lock file for #$ISSUE_ID. Skipping."; continue; }

    # Start gemini in the background
    gemini -p "AUTONOMOUS FIX: Resolve GitHub Issue #$ISSUE_ID in the InunuNet/Athanor repository. Research, implement the fix, verify, and push to GitHub." --approval-mode yolo &
    PID=$!
    echo "${PROJECT_PREFIX}Initiated autonomous fix for #$ISSUE_ID. Cooling down for 60 seconds to prevent quota exhaustion."
    sleep 60
done < <(echo "$ISSUES_JSON" | jq -r '.[] | "\(.number)\n\(.title)"') # Process substitution

echo "${PROJECT_PREFIX}All issues queued."

echo "${PROJECT_PREFIX}All autonomous fixes initiated and their immediate processes completed."

# Clean up all locally created lock files.
echo "${PROJECT_PREFIX}Cleaning up local processing lock files in $PROCESSING_DIR."
rm -f "$PROCESSING_DIR"/*.lock

echo "${PROJECT_PREFIX}auto_fix_issues.sh script finished."
