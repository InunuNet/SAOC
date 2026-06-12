#!/usr/bin/env bash
# get_pulse_status.sh — check launchctl status for com.athanor.pulse

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$PROJECT_ROOT/pulse.log"
SERVICE="com.athanor.pulse"

if launchctl list "$SERVICE" 2>/dev/null | grep -q "$SERVICE"; then
    echo "Pulse: RUNNING"
    if [ -f "$LOG_FILE" ]; then
        echo "Log: $LOG_FILE ($(wc -l < "$LOG_FILE") lines)"
    else
        echo "Log: not yet created"
    fi
    exit 0
else
    if launchctl list 2>/dev/null | grep -q "$SERVICE"; then
        echo "Pulse: STOPPED"
        echo "   Run: launchctl start $SERVICE  (to start)"
    else
        echo "Pulse: NOT INSTALLED"
        echo "   Run: make install-pulse  (to install)"
        echo "   Run: make pulse-start    (to start)"
    fi
    if [ -f "$LOG_FILE" ]; then
        echo "Log: $LOG_FILE ($(wc -l < "$LOG_FILE") lines)"
    fi
    exit 1
fi
