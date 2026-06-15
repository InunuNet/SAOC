#!/bin/bash

# Dynamic path resolution for project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${ATHANOR_PROJECT_ROOT:-$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")}"
GH_CMD="${ATHANOR_GH_CMD:-gh}"
TICKET_HELPER="$PROJECT_ROOT/execution/pulse_ticket.py"
MAX_GITHUB_AUTOFIX_PER_RUN=1

# Extract PROJECT_NAME from .agent/profile.json
PROJECT_NAME=$(jq -r '.project_name' "$PROJECT_ROOT/.agent/profile.json")
PROJECT_PREFIX="[${PROJECT_NAME}] "

# Define directory for tracking issues currently being processed
PROCESSING_DIR="$PROJECT_ROOT/.agent/pulse/registry/processing"
mkdir -p "$PROCESSING_DIR" || { echo "${PROJECT_PREFIX}Failed to create processing directory '$PROCESSING_DIR'. Exiting."; exit 1; }

if [ "${ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX:-0}" != "1" ]; then
    echo "${PROJECT_PREFIX}GitHub issue autofix disabled. Set ATHANOR_ENABLE_GITHUB_ISSUE_AUTOFIX=1 to enable."
    exit 0
fi

echo "${PROJECT_PREFIX}Starting auto_fix_issues.sh script..."
echo "${PROJECT_PREFIX}Fetching up to $MAX_GITHUB_AUTOFIX_PER_RUN open issue from InunuNet/Athanor..."

# Fetch all open issues from the repository
ISSUES_JSON=$("$GH_CMD" issue list --repo InunuNet/Athanor --limit "$MAX_GITHUB_AUTOFIX_PER_RUN" --state open --json number,title 2>/dev/null)

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

    echo "${PROJECT_PREFIX}Enqueueing autonomous fix ticket for Issue #$ISSUE_ID (Title: '$ISSUE_TITLE')"

    # Create a lock file to mark the issue as in-progress
    touch "$PROCESSING_DIR/$ISSUE_ID.lock" || { echo "${PROJECT_PREFIX}Failed to create lock file for #$ISSUE_ID. Skipping."; continue; }

    if [ ! -x "$TICKET_HELPER" ]; then
        echo "${PROJECT_PREFIX}pulse_ticket.py unavailable — no provider launched for #$ISSUE_ID"
        continue
    fi
    python3 "$TICKET_HELPER" enqueue \
        --source auto_fix_issues \
        --kind github_issue_fix \
        --project-path "$PROJECT_ROOT" \
        --provider gemini-cli \
        --requires-model true \
        --prompt "AUTONOMOUS FIX: Resolve GitHub Issue #$ISSUE_ID in the InunuNet/Athanor repository. Research, implement the fix, verify, and push to GitHub." \
        --dedupe-key "auto-fix-issue:InunuNet/Athanor:$ISSUE_ID" \
        --max-turns "${ATHANOR_PULSE_ISSUE_MAX_TURNS:-1}" \
        --max-tokens "${ATHANOR_PULSE_ISSUE_MAX_TOKENS:-30000}"
    echo "${PROJECT_PREFIX}Autonomous fix ticket enqueued for #$ISSUE_ID."
    break
done < <(echo "$ISSUES_JSON" | jq -r '.[] | "\(.number)\n\(.title)"') # Process substitution

echo "${PROJECT_PREFIX}Autonomous issue fix pass complete."

echo "${PROJECT_PREFIX}auto_fix_issues.sh script finished."
