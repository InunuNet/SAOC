#!/bin/bash

# Prepend common paths for CLI tools (gh, jq)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Ensure we are in the project root (registry scripts are run from project root by pulse_runner.sh)
if [ ! -d ".agent" ]; then
    echo "Error: Must be run from project root."
    exit 1
fi

# Extract PROJECT_NAME from .agent/profile.json
# Assuming this script is run from PROJECT_ROOT, so .agent/profile.json is correct
PROJECT_NAME=$(jq -r '.project_name' .agent/profile.json)
PROJECT_PREFIX="[${PROJECT_NAME}] "

if ! command -v gh &> /dev/null; then
    echo "${PROJECT_PREFIX}Error: GitHub CLI (gh) not found. Please install it and authenticate."
    exit 1
fi

# Ensure `jq` is installed for JSON parsing
if ! command -v jq &> /dev/null; then
    echo "${PROJECT_PREFIX}Error: jq not found. Please install jq for proper GitHub issue parsing."
    exit 1
fi

STATE_FILE=".agent/pulse/last_github_id"
REPO="InunuNet/Athanor"
INBOX_DIR=".agent/memory/project/inbox"

# Ensure the inbox directory exists
mkdir -p "$INBOX_DIR"

# Ensure the state file exists, initialize if not
if [ ! -f "$STATE_FILE" ]; then
    echo "${PROJECT_PREFIX}Initializing GitHub issue tracking state file."
    echo "0" > "$STATE_FILE"
fi

LAST_ID=$(cat "$STATE_FILE")
NEW_LAST_ID="$LAST_ID" # Initialize with current last ID

echo "${PROJECT_PREFIX}Checking for new GitHub issues in $REPO since ID $LAST_ID..."

# Fetch issues, sorted by creation date, descending.
# Using --json id,title,url to get structured output.
# Limiting to 10 to reduce payload and focus on recent activity.
issues_json=$(gh issue list --repo "$REPO" --limit 10 --json number,title,url --state "open")

# Parse JSON to find new issues and update LAST_ID
# Using process substitution to keep NEW_LAST_ID in the current shell
while read -r issue; do
    current_id=$(echo "$issue" | jq -r '.number') # `number` is the issue ID
    
    if (( current_id > LAST_ID )); then
        ISSUE_TITLE=$(echo "$issue" | jq -r '.title')
        ISSUE_URL=$(echo "$issue" | jq -r '.url')
        echo "${PROJECT_PREFIX}New GitHub Issue (ID: $current_id): $ISSUE_TITLE - $ISSUE_URL"
        
        # Write to inbox file
        echo "GitHub Issue Found:" > "$INBOX_DIR/check_github-$current_id.txt"
        echo "ID: $current_id" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "Title: $ISSUE_TITLE" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "URL: $ISSUE_URL" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$INBOX_DIR/check_github-$current_id.txt"

        # Update NEW_LAST_ID if this issue has a higher ID
        if (( current_id > NEW_LAST_ID )); then
            NEW_LAST_ID="$current_id"
        fi
    fi
done < <(echo "$issues_json" | jq -c '.[]')

# If new issues were found, update the state file
if (( NEW_LAST_ID > LAST_ID )); then
    echo "${PROJECT_PREFIX}Updating last processed GitHub issue ID to $NEW_LAST_ID."
    echo "$NEW_LAST_ID" > "$STATE_FILE"
else
    echo "${PROJECT_PREFIX}No new GitHub issues found."
fi

echo "${PROJECT_PREFIX}check_github.sh script finished."
