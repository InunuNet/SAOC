#!/usr/bin/env bash
# fleet_update.sh — Synchronizes all Athanor projects in ~/ai with the latest template.
# Designed by @architect. Driven by @dev.

BASE_DIR="$HOME/ai"
REPORT_FILE="fleet_update_report_$(date +%Y%m%d_%H%M).md"
CORE_ROOT=$(pwd)

echo "# Athanor Fleet Update Report - $(date)" > "$REPORT_FILE"
echo "| Project | Branch | Update | Sync | Audit | Boot | Notes |" >> "$REPORT_FILE"
echo "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |" >> "$REPORT_FILE"

echo "🚀 Starting Fleet Update for projects in $BASE_DIR..."

# List of projects identified during discovery
PROJECTS=(
    "Acrux Accounting"
    "Alembic"
    "ai.inunu.net"
    "brain_storm_ai"
    "GJ Dauth Estate"
    "HomeClaw"
    "Inunu Net App"
    "LanScout"
    "Mlilo"
    "Mlilo Savant"
    "Mumbl AI"
    "Phising Attack Back"
    "PortPulse"
    "SAOC"
    "Sowilo"
    "SysMon"
    "SysMonitor"
    "wh3"
    "ZOHO"
)

for proj in "${PROJECTS[@]}"; do
    PROJ_PATH="$BASE_DIR/$proj"
    echo "------------------------------------------------------------"
    echo "📦 Project: $proj"
    
    if [ ! -d "$PROJ_PATH" ]; then
        echo "| $proj | - | - | - | - | - | Directory missing |" >> "$REPORT_FILE"
        continue
    fi

    (
        cd "$PROJ_PATH" || exit 1
        
        # 1. Identity & Git State
        CUR_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "non-git")
        UPDATE_BRANCH="fix/athanor-v3-sync-$(date +%H%M)"
        STASHED="No"
        
        if [ "$CUR_BRANCH" != "non-git" ]; then
            if [ -n "$(git status --porcelain)" ]; then
                git stash push --include-untracked -m "Pre-fleet-update stash"
                STASHED="Yes"
            fi
            git checkout -b "$UPDATE_BRANCH" 2>/dev/null
        else
            UPDATE_BRANCH="N/A"
        fi

        # 2. Update Template (Driven from Core)
        echo "  🔄 Running update-template..."
        cd "$CORE_ROOT"
        make update-template TARGET="$PROJ_PATH" FORCE_UPDATE=true > /dev/null 2>&1
        UPDATE_STATUS=$?
        cd "$PROJ_PATH"

        # 3. Sync
        echo "  🔄 Running make sync..."
        make sync > /dev/null 2>&1
        SYNC_STATUS=$?

        # 4. Audit
        echo "  🔄 Running make audit..."
        make audit > /dev/null 2>&1
        AUDIT_STATUS=$?

        # 5. Boot Validation
        echo "  🔄 Running boot validation..."
        BOOT_LOG=$(timeout 15s bash full_boot.sh 2>&1)
        if echo "$BOOT_LOG" | grep -q "BOOT COMPLETE"; then
            BOOT_STATUS=0
        else
            BOOT_STATUS=1
        fi

        # Helper for emoji status
        stat_emoji() { [ "$1" -eq 0 ] && echo "✅" || echo "❌"; }

        NOTES=""
        [ "$STASHED" == "Yes" ] && NOTES="Stashed changes. "
        [ "$BOOT_STATUS" -ne 0 ] && NOTES="${NOTES}Boot check failed."

        echo "| $proj | $UPDATE_BRANCH | $(stat_emoji $UPDATE_STATUS) | $(stat_emoji $SYNC_STATUS) | $(stat_emoji $AUDIT_STATUS) | $(stat_emoji $BOOT_STATUS) | $NOTES |" >> "$CORE_ROOT/$REPORT_FILE"
    ) || {
        echo "| $proj | ERROR | ❌ | - | - | - | Critical failure during processing |" >> "$REPORT_FILE"
    }

done

echo "------------------------------------------------------------"
echo "✅ Fleet Update Complete. Report generated: $REPORT_FILE"
