#!/bin/bash

LOG_FILE="$(pwd)/pulse.log"

echo "PULSE STATUS DASHBOARD"
echo "----------------------------------------------------------------------------------------------------"
printf "%-20s | %-20s | %-10s | %-10s | %s\n" "TIMESTAMP" "JOB NAME" "STATUS" "EXIT CODE" "SNIPPET"
echo "----------------------------------------------------------------------------------------------------"

if [ -f "$LOG_FILE" ]; then
  cat "$LOG_FILE" | awk -F ' [|] ' 'NF >= 4 {
    # Only process data lines (4+ fields); skip info/status lines with no " | " separators
    raw = $1
    # Strip "[project-name] " or "[project_name] " prefix from field 1
    sub(/^\[[^]]*\] /, "", raw)
    timestamp = raw
    job_name = $2
    status = $3
    exit_code = $4
    snippet = NF >= 5 ? $5 : "(none)"

    # Format timestamp for better readability (e.g., 2023-10-27 10:30:00)
    formatted_timestamp = substr(timestamp, 1, 4) "-" substr(timestamp, 5, 2) "-" substr(timestamp, 7, 2) " " substr(timestamp, 9, 2) ":" substr(timestamp, 11, 2) ":" substr(timestamp, 13, 2)

    printf "%-20s | %-20s | %-10s | %-10s | %s\n", formatted_timestamp, job_name, status, exit_code, snippet
  }'
else
  echo "No pulse log file found at $LOG_FILE."
fi

echo "----------------------------------------------------------------------------------------------------"
