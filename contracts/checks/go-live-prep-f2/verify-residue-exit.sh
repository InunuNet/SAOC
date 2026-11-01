#!/bin/bash
# Usage: verify-residue-exit.sh <mode> <arg> <expected-exit> [expected-stdout-grep]
# Runs scripts/scan-dataset-residue.ts with a fixture or stubbed fetch error and checks the exit code
# (and optionally a line in stdout). Offline: no credentials read, no network.
mode="$1"; arg="$2"; want="$3"; pat="${4:-}"
out=$(pnpm exec tsx scripts/scan-dataset-residue.ts "$mode" "$arg" 2>&1); got=$?
if [ "$got" != "$want" ]; then echo "FAIL: exit $got, expected $want"; echo "$out" | tail -5; exit 1; fi
if [ -n "$pat" ] && ! echo "$out" | grep -q -- "$pat"; then echo "FAIL: output lacks: $pat"; exit 1; fi
echo "PASS: $mode $arg -> exit $got"
