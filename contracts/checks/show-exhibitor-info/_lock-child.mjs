#!/usr/bin/env node
// Child process used only by check-lock-safety.mjs. It exists because the two behaviours that
// matter most about the lock — "does not steal a lock a LIVE process holds" and "releases on
// SIGTERM" — cannot be observed from inside the process that holds the lock.
//
// Usage:
//   _lock-child.mjs hold <seconds>      acquire, print HELD, sleep, release
//   _lock-child.mjs try  <seconds>      try to acquire for N seconds, print ACQUIRED or TIMEOUT
//
// EXH_LOCK_PATH must be set by the caller; this never runs against the real lock.

import { withDatasetLock } from './_mutation-guard.mjs';

const [mode, secondsArg] = process.argv.slice(2);
const seconds = Number(secondsArg);

if (!process.env.EXH_LOCK_PATH) {
  console.error('refusing to run without EXH_LOCK_PATH — this helper must never touch the real lock');
  process.exit(1);
}

if (mode === 'hold') {
  await withDatasetLock('lock-child-holder', async () => {
    console.log('HELD');
    await new Promise((res) => setTimeout(res, seconds * 1000));
  });
  process.exit(0);
}

if (mode === 'try') {
  // A bounded attempt: the real wait timeout is 15 minutes, which is not a test.
  const timer = setTimeout(() => {
    console.log('TIMEOUT');
    process.exit(0);
  }, seconds * 1000);
  timer.unref();
  await withDatasetLock('lock-child-contender', async () => {
    console.log('ACQUIRED');
  });
  process.exit(0);
}

console.error(`unknown mode ${JSON.stringify(mode)}`);
process.exit(1);
