#!/usr/bin/env bash
# F4: the stamp, the sandbox-mode leaf, Ozow's IsTest and PayFast's initiate must agree. See adapter-guard.mjs.
set -u
node contracts/checks/door-reject-test-tickets/adapter-guard.mjs coupling . || exit 1
node contracts/checks/door-reject-test-tickets/adapter-guard.mjs client-safe . || exit 1
node contracts/checks/door-reject-test-tickets/adapter-guard.mjs checkout . || exit 1
node contracts/checks/door-reject-test-tickets/adapter-guard.mjs diff || exit 1
git diff --quiet origin/main -- lib/ticketing-test-mode.ts scripts
