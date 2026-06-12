#!/usr/bin/env bash
# qa_guard.sh — Standards enforcer and regression detector.
# Runs on every project after changes. Enforces coding standards, runs tests,
# commits clean work, and files GitHub issues for regressions. Runs every 15min.

set -euo pipefail
LOG="[qa-guard]"
ATHANOR_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

# Map: local path → GitHub repo (parallel arrays — bash 3.2 compatible)
PROJECT_PATHS=(
  "/Users/vetus/ai/Gemini Harness"
  # "/Users/vetus/ai/Codex Harness"  # TEMP: disabled 2026-06-09 — profile reset loop; restore after update_template.py guard fix ships
  "/Users/vetus/ai/Mumbl AI"
  "/Users/vetus/ai/SAOC"
  "/Users/vetus/ai/wh3"
  "/Users/vetus/ai/Alembic"
  "/Users/vetus/ai/Acrux Accounting"
  "/Users/vetus/ai/Mlilo Admin"
)
PROJECT_REPO_NAMES=(
  "InunuNet/Athanor"
  "InunuNet/Athanor"
  "InunuNet/MumblAI"
  "BDauth/SAOC"
  "InunuNet/wh3"
  "InunuNet/Alembic"
  "InunuNet/AcruxAccounting"
  "InunuNet/mlilo-admin"
)

for i in "${!PROJECT_PATHS[@]}"; do
  PROJECT_PATH="${PROJECT_PATHS[$i]}"
  REPO="${PROJECT_REPO_NAMES[$i]}"
  [[ -d "$PROJECT_PATH" ]] || continue
  [[ -d "$PROJECT_PATH/.git" ]] || continue

  cd "$PROJECT_PATH"
  PROJECT_NAME=$(basename "$PROJECT_PATH")
  echo "$LOG Checking: $PROJECT_NAME → $REPO"

  # Check for uncommitted changes
  DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  if [[ "$DIRTY" -gt 0 ]]; then
    # Run standards check before committing
    STANDARDS_ISSUES=""

    # Check for hardcoded secrets (basic)
    if git diff --cached --unified=0 -- . ':!contracts/' 2>/dev/null | grep -iE "(api_key|secret|password|token)\s*=\s*['\\\"][^'\\\"]{8}" 2>/dev/null | grep -v "^---\|^+++"; then
      STANDARDS_ISSUES="Possible hardcoded secret detected in staged changes."
    fi

    # Check for print debugging (Python)
    if git diff --unified=0 -- . ':!template/' ':!execution/' 2>/dev/null | grep "^+.*print(" | grep -v "^+++\|#.*print\|test_\|logging" | head -3 | grep -q "."; then
      STANDARDS_ISSUES="${STANDARDS_ISSUES} Debug print() statements found."
    fi

    if [[ -n "$STANDARDS_ISSUES" ]]; then
      echo "$LOG STANDARDS VIOLATION in $PROJECT_NAME: $STANDARDS_ISSUES"
      EXISTING=$(gh issue list --repo "$REPO" --state open \
        --search 'Coding standards violation detected in:title' \
        --limit 1 --json number --jq 'length' 2>/dev/null || echo "")
      if [[ -z "$EXISTING" || "$EXISTING" -eq 0 ]] 2>/dev/null; then
        gh issue create --repo "$REPO" \
          --title "[STANDARDS] Coding standards violation detected" \
          --body "Automated qa_guard detected: $STANDARDS_ISSUES
Project: $PROJECT_NAME
Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Action required: review and fix before next commit." 2>/dev/null || \
          echo "$LOG WARN: could not file standards issue for $PROJECT_NAME" >&2
      fi
      continue
    fi

    # Auto-commit clean changes
    git add -A 2>/dev/null || true
    git commit -m "chore(auto): qa_guard checkpoint — standards clean $(date +%Y-%m-%d)" \
      --no-verify 2>/dev/null || true
  fi

  # Push to own repo
  BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
  if git push origin "$BRANCH" 2>/dev/null; then
    echo "$LOG Pushed $PROJECT_NAME to $REPO/$BRANCH"
  else
    echo "$LOG WARN: push failed for $PROJECT_NAME" >&2
  fi

  # Run tests if available
  if [[ -f "Makefile" ]] && grep -q "^test:" Makefile 2>/dev/null; then
    echo "$LOG Running tests for $PROJECT_NAME..."
    if ! make test 2>&1 | tail -5; then
      FAIL_SUMMARY=$(make test 2>&1 | tail -10 | tr '\n' ' ')
      echo "$LOG REGRESSION in $PROJECT_NAME — filing issue"
      EXISTING=$(gh issue list --repo "$REPO" --state open \
        --search 'Test suite failing in:title' \
        --limit 1 --json number --jq 'length' 2>/dev/null || echo "")
      if [[ -z "$EXISTING" || "$EXISTING" -eq 0 ]] 2>/dev/null; then
        gh issue create --repo "$REPO" \
          --title "[REGRESSION] Test suite failing in $PROJECT_NAME" \
          --body "Automated qa_guard detected test failures:

\`\`\`
${FAIL_SUMMARY}
\`\`\`

Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Action: investigate and fix before continuing self-improvement loop." 2>/dev/null || \
          echo "$LOG WARN: could not file regression issue" >&2
      fi
    else
      echo "$LOG Tests PASS for $PROJECT_NAME"
    fi
  fi

  cd "$ATHANOR_ROOT"
done

echo "$LOG QA guard pass complete."
