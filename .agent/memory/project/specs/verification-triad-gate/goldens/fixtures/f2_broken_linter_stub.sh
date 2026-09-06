#!/usr/bin/env bash
# f2_broken_linter_stub.sh -- golden fixture simulating an infrastructure
# failure in the triad-coverage linter (mission verification-triad-gate
# M2/F2, decision 1: fail-closed on a linter infra error). Used by
# verify_f2_triad_failclosed.sh via TRIAD_LINTER_SCRIPT_OVERRIDE. Exits 9,
# a code outside verify_triad_coverage.py's documented 0/1/2 contract, so
# contract.py's preflight cannot mistake this for a real classification
# result (PASS/EXEMPT/FAIL/usage-error) -- it must recognise "exit code I
# don't understand" as its own distinct failure mode and block.
exit 9
