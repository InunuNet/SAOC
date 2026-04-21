#!/usr/bin/env bash
#
# Helper script to determine the current GitHub repository owner and name.
# Prioritizes `gh` CLI, falls back to `git` remotes.
#
# Output format: OWNER/REPO_NAME (e.g., InunuNet/Athanor)
# Exits with error if unable to determine.

set -euo pipefail

# Load .env if it exists and export GITHUB_TOKEN
if [ -f ./.env ]; then
    set -a # automatically export all variables
    source ./.env
    set +a # stop automatically exporting
    if [ -n "${GITHUB_TOKEN:-}" ]; then
        export GITHUB_TOKEN
    fi
fi

# Check for gh CLI
if command -v gh >/dev/null 2>&1; then
    if gh auth status >/dev/null 2>&1; then
        # gh CLI is available and authenticated
        REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
        if [ -n "$REPO_SLUG" ]; then
            echo "$REPO_SLUG"
            exit 0
        fi
    fi
fi

# Fallback to git remotes
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    REMOTE_URL=$(git remote get-url origin 2>/dev/null || git config --get remote.origin.url 2>/dev/null)
    if [ -n "$REMOTE_URL" ]; then
        # Extract owner/repo from common GitHub URL patterns
        # HTTPS: https://github.com/owner/repo.git
        # SSH: git@github.com:owner/repo.git
        # Regex to capture 'owner/repo'
        if [[ "$REMOTE_URL" =~ github\.com[:/]([^/]+)/([^/]+)(\.git)? ]]; then
            OWNER="${BASH_REMATCH[1]}"
            REPO_NAME="${BASH_REMATCH[2]}"
            # Remove .git suffix if present
            REPO_NAME="${REPO_NAME%.git}"
            echo "${OWNER}/${REPO_NAME}"
            exit 0
        fi
    fi
fi

echo "Error: Unable to determine GitHub repository owner/name." >&2
exit 1
