#!/usr/bin/env bash
# Journal test runner — 15 cases covering append/checkpoint/recover/query.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JOURNAL_DIR="$(dirname "$SCRIPT_DIR")"
JOURNAL="$JOURNAL_DIR/journal.py"

echo "Running Journal tests..."
echo "  Journal: $JOURNAL"
echo "  Python:  $(python3 --version)"
echo ""

PASS=0
FAIL=0

WORK=$(mktemp -d)
cleanup() { command rm -r -f "$WORK"; }
trap cleanup EXIT

run_test() {
    local name="$1" expected="$2"; shift 2
    local actual
    actual=$("$@" 2>/dev/null)
    if [ "$actual" = "$expected" ]; then
        echo "  PASS $name"
        PASS=$((PASS+1))
    else
        echo "  FAIL $name"
        echo "    expected: $(printf '%s' "$expected" | head -c 200)"
        echo "    actual:   $(printf '%s' "$actual"   | head -c 200)"
        FAIL=$((FAIL+1))
    fi
}

LOG="$WORK/t1.log"
python3 "$JOURNAL" append --log "$LOG" --key alpha --value one >/dev/null
run_test "t01 append+query basic round-trip" "one"     python3 "$JOURNAL" query --log "$LOG" --key alpha

LOG="$WORK/t2.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key c --value 3 >/dev/null
expected=$'a=1
b=2
c=3'
run_test "t02 recover multiple keys sorted" "$expected"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t3.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key c --value 3 >/dev/null
run_test "t03 recover replays only post-checkpoint writes" "c=3"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t4.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key c --value 3 >/dev/null
run_test "t04 last checkpoint wins not first" "c=3"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t5.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
printf '%s
' '{"seq":3,"type":"CRASH"}' >> "$LOG"
printf '%s
' '{"seq":4,"type":"WRITE","key":"c","value":"GARBAGE"}' >> "$LOG"
expected=$'a=1
b=2'
run_test "t05 CRASH stops reading; post-CRASH writes ignored" "$expected"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t6.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
printf '%s
' '{"seq":3,"type":"CRASH"}' >> "$LOG"
printf '%s
' '{"seq":4,"type":"WRITE","key":"x","value":"bad"}' >> "$LOG"
run_test "t06 checkpoint+CRASH+post-CRASH writes -> empty replay" ""     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t7.log"
touch "$LOG"
out=$(python3 "$JOURNAL" recover --log "$LOG" 2>/dev/null); rc=$?
if [ "$out" = "" ] && [ "$rc" = "0" ]; then
    echo "  PASS t07 empty log -> empty output exit 0"; PASS=$((PASS+1))
else
    echo "  FAIL t07 empty log: rc=$rc out='$out'"; FAIL=$((FAIL+1))
fi

LOG="$WORK/t8.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
run_test "t08 query missing key -> NOT FOUND" "NOT FOUND"     python3 "$JOURNAL" query --log "$LOG" --key zzz

LOG="$WORK/t9.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value first >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key a --value second >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key a --value third >/dev/null
run_test "t09 query after overwrites -> last value wins" "third"     python3 "$JOURNAL" query --log "$LOG" --key a

LOG="$WORK/t10.log"
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
expected=$'a=1
b=2'
run_test "t10 committed_through=0 -> replay all subsequent writes" "$expected"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t11.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
printf '%s
' '{"seq":4,"type":"CHECKPOINT","committed_through":99}' >> "$LOG"
python3 "$JOURNAL" append --log "$LOG" --key c --value 3 >/dev/null
expected=$'b=2
c=3'
run_test "t11 malformed checkpoint (commit>max_write) ignored" "$expected"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t12.log"
OUT="$WORK/t12.out"
python3 "$JOURNAL" append --log "$LOG" --key a --value 1 >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value 2 >/dev/null
stdout_capture=$(python3 "$JOURNAL" recover --log "$LOG" --output "$OUT" 2>/dev/null)
file_content=$(cat "$OUT" 2>/dev/null)
expected=$'a=1
b=2'
if [ "$stdout_capture" = "" ] && [ "$file_content" = "$expected" ]; then
    echo "  PASS t12 --output writes to file not stdout"; PASS=$((PASS+1))
else
    echo "  FAIL t12: stdout='$stdout_capture' file='$file_content'"; FAIL=$((FAIL+1))
fi

LOG="$WORK/t13.log"
python3 "$JOURNAL" append --log "$LOG" --key x --value old >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key y --value yval >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key x --value mid >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key x --value new >/dev/null
expected=$'x=new
y=yval'
run_test "t13 recover last-write-wins per key" "$expected"     python3 "$JOURNAL" recover --log "$LOG"

LOG="$WORK/t14.log"
touch "$LOG"
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
content=$(cat "$LOG")
if printf '%s' "$content" | python3 -c "import sys,json; line=sys.stdin.read().strip(); o=json.loads(line); assert o.get('type')=='CHECKPOINT' and o.get('committed_through')==0 and o.get('seq')==1" 2>/dev/null; then
    echo "  PASS t14 checkpoint on empty log -> committed_through=0 seq=1"; PASS=$((PASS+1))
else
    echo "  FAIL t14: content='$content'"; FAIL=$((FAIL+1))
fi

LOG="$WORK/t15.log"
python3 "$JOURNAL" append --log "$LOG" --key a --value durable >/dev/null
python3 "$JOURNAL" checkpoint --log "$LOG" >/dev/null
python3 "$JOURNAL" append --log "$LOG" --key b --value inflight >/dev/null
run_test "t15a query in-flight write after checkpoint -> visible" "inflight"     python3 "$JOURNAL" query --log "$LOG" --key b
run_test "t15b query checkpointed key not in redo set -> NOT FOUND" "NOT FOUND"     python3 "$JOURNAL" query --log "$LOG" --key a

TOTAL=$((PASS+FAIL))
echo ""
if [ $FAIL -eq 0 ]; then
    echo "PASS $PASS/$TOTAL"
    exit 0
else
    echo "FAIL $FAIL/$TOTAL failed"
    exit 1
fi
