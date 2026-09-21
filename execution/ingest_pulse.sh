#!/bin/bash

# Prepend common paths for CLI tools (gh, jq)
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# Dynamic path resolution
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${PROJECT_ROOT:-$(dirname "$SCRIPT_DIR")}"

# Get PROJECT_NAME from argument
PROJECT_NAME="$1"
PROJECT_PREFIX="[${PROJECT_NAME}] "

INBOX_DIR="$PROJECT_ROOT/.agent/memory/project/inbox"
BACKLOG_FILE="$PROJECT_ROOT/.agent/memory/project/backlog.md"
ARCHIVE_DIR="$PROJECT_ROOT/.agent/memory/project/inbox/archive"

mkdir -p "$ARCHIVE_DIR" # Ensure archive directory exists

echo "${PROJECT_PREFIX}--- Running ingest_pulse.sh ---"

# Check if inbox directory exists
if [ ! -d "$INBOX_DIR" ]; then
    echo "${PROJECT_PREFIX}Inbox directory not found: $INBOX_DIR"
    exit 0
fi

# Find all files in the inbox, excluding directories, and process them
find "$INBOX_DIR" -maxdepth 1 -type f -name "*.txt" | while read -r inbox_file; do
    if [ -f "$inbox_file" ]; then
        filename=$(basename "$inbox_file")
        echo "${PROJECT_PREFIX}Processing: $filename"
        
        # Determine summary from file content
        if [[ "$filename" == check_github-* ]]; then
            # Extract issue number and title from multi-line format
            ISSUE_NUM=$(grep "^ID: " "$inbox_file" | head -n 1 | cut -d' ' -f2)
            TITLE=$(grep "^Title: " "$inbox_file" | head -n 1 | cut -d' ' -f2-)

            if [ -n "$ISSUE_NUM" ] && [ -n "$TITLE" ]; then
                SUMMARY="GitHub #$ISSUE_NUM: $TITLE"
            elif [ -n "$TITLE" ]; then
                SUMMARY="GitHub Issue: $TITLE" # Fallback if only title is available
            else
                # No parseable issue — routine check output, archive silently
                mv "$inbox_file" "$ARCHIVE_DIR/"
                echo "${PROJECT_PREFIX}Archived (routine check, no issue): $filename"
                continue
            fi
            ITEM="- [ ] ${PROJECT_NAME} (GitHub): $SUMMARY"
        elif [[ "$filename" == mock_failure-* ]]; then
            SUMMARY=$(head -n 1 "$inbox_file")
            ITEM="- [ ] ${PROJECT_NAME} (Alert): $SUMMARY"
        elif [[ "$filename" == loop_failure-* ]]; then
            SUMMARY=$(head -n 1 "$inbox_file")
            ITEM="- [ ] ${PROJECT_NAME} (Alert): $SUMMARY"
        elif [[ "$filename" == loop_converged-* ]]; then
            SUMMARY=$(head -n 1 "$inbox_file")
            ITEM="- [ ] ${PROJECT_NAME} (Milestone): $SUMMARY"
        elif [[ "$filename" == codi-directive-* || "$filename" == auto_update-* || "$filename" == comms-issue-* || "$filename" == fleet_loop-* || "$filename" == fleet_improve-* || "$filename" == shepherd-* || "$filename" == pain_point_monitor-* || "$filename" == watch_eve_comms-* || "$filename" == orchestrate-* || "$filename" == mission_loop-* || "$filename" == comms_poll-* || "$filename" == watch_comms-* || "$filename" == auto_fix_issues-* ]]; then
            # Routine informational signals — archive silently, no backlog item
            mv "$inbox_file" "$ARCHIVE_DIR/"
            echo "${PROJECT_PREFIX}Archived (routine): $filename"
            continue
        else
            SUMMARY=$(head -n 1 "$inbox_file" | cut -c 1-100)
            [ -z "$SUMMARY" ] && SUMMARY="New Event: $filename"
            ITEM="- [ ] ${PROJECT_NAME} (Misc): $SUMMARY"
        fi

        # Check for duplicates
        if grep -qF -- "$ITEM" "$BACKLOG_FILE"; then
            echo "${PROJECT_PREFIX}Item already exists in backlog: $ITEM"
        else
            # Check for Priority section in backlog.md
            if grep -q "## Priority" "$BACKLOG_FILE"; then
                # Insert AFTER Priority header
                sed -i.bak "/## Priority/a \\
$ITEM" "$BACKLOG_FILE" && rm "$BACKLOG_FILE.bak"
            else
                # Append to end if no Priority section
                echo -e "\n$ITEM" >> "$BACKLOG_FILE"
            fi
            echo "${PROJECT_PREFIX}Added to backlog: $ITEM"
        fi

        # Archive the file
        mv "$inbox_file" "$ARCHIVE_DIR/"
        echo "${PROJECT_PREFIX}Archived: $filename"
    fi
done

echo "${PROJECT_PREFIX}--- ingest_pulse.sh finished ---"
