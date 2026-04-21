#!/bin/bash

# Path to the dummy file
DUMMY_FILE="./execution/tests/dummy_file.txt"
# Log file for parallel reads
LOG_FILE="./execution/tests/stress_test_log.txt"
# Number of parallel reads
NUM_READS=50

echo "Starting stress test: $NUM_READS parallel reads of $DUMMY_FILE"
echo "Logs will be written to $LOG_FILE"
echo "" > "$LOG_FILE" # Clear log file

# Run parallel reads
for i in $(seq 1 $NUM_READS); do
  (
    cat "$DUMMY_FILE" > /dev/null
    if [ $? -eq 0 ]; then
      echo "Read $i successful" >> "$LOG_FILE"
    else
      echo "Read $i failed" >> "$LOG_FILE"
    fi
  ) &
done

# Wait for all background jobs to complete
wait

SUCCESS_COUNT=$(grep -c "successful" "$LOG_FILE")
FAILURE_COUNT=$(grep -c "failed" "$LOG_FILE")

echo "Stress test finished."
echo "Total successful reads: $SUCCESS_COUNT"
echo "Total failed reads: $FAILURE_COUNT"

if [ "$SUCCESS_COUNT" -eq "$NUM_READS" ]; then
  echo "Stress test PASSED: All $NUM_READS reads were successful."
  exit 0
else
  echo "Stress test FAILED: $FAILURE_COUNT reads failed."
  exit 1
fi

# Clean up log file (optional, for manual inspection this can be commented out)
# rm "$LOG_FILE"