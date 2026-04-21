#!/bin/bash

# Prepend common paths for CLI tools (gh, jq)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Ensure we are in the project root
if [ ! -d ".agent" ]; then
    echo "Error: Must be run from project root."
    exit 1
fi

# Detect Repo Slug if not provided
if [ -z "$REPO_SLUG" ]; then
    if command -v gh &> /dev/null; then
        REPO_SLUG=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null || echo "")
    fi
fi

if [ -z "$REPO_SLUG" ]; then
    echo "Skipping: No GitHub repository detected for this project."
    exit 0
fi

if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) not found. Please install it and authenticate."
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq not found. Please install jq for proper GitHub issue parsing."
    exit 1
fi

STATE_FILE=".agent/pulse/last_github_id"
INBOX_DIR=".agent/memory/project/inbox"

mkdir -p "$INBOX_DIR"

if [ ! -f "$STATE_FILE" ]; then
    echo "0" > "$STATE_FILE"
fi

LAST_ID=$(cat "$STATE_FILE")
NEW_LAST_ID="$LAST_ID"

issues_json=$(gh issue list --repo "$REPO_SLUG" --limit 10 --json number,title,url --state "open" 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch issues for $REPO_SLUG"
    exit 1
fi

while read -r issue; do
    [ -z "$issue" ] && continue
    current_id=$(echo "$issue" | jq -r '.number')
    
    if (( current_id > LAST_ID )); then
        ISSUE_TITLE=$(echo "$issue" | jq -r '.title')
        ISSUE_URL=$(echo "$issue" | jq -r '.url')
        echo "New GitHub Issue (ID: $current_id): $ISSUE_TITLE - $ISSUE_URL"
        
        echo "GitHub Issue Found:" > "$INBOX_DIR/check_github-$current_id.txt"
        echo "ID: $current_id" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "Title: $ISSUE_TITLE" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "URL: $ISSUE_URL" >> "$INBOX_DIR/check_github-$current_id.txt"
        echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')" >> "$INBOX_DIR/check_github-$current_id.txt"

        if (( current_id > NEW_LAST_ID )); then
            NEW_LAST_ID="$current_id"
        fi
    fi
done < <(echo "$issues_json" | jq -c '.[]' 2>/dev/null)

if (( NEW_LAST_ID > LAST_ID )); then
    echo "$NEW_LAST_ID" > "$STATE_FILE"
fi
