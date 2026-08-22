#!/usr/bin/env node
// Child process used only by check-lock-safety.mjs. The two behaviours that matter —
// "a lock taken by one contract's guard is respected by the other's" and "the lock actually
// releases" — cannot be observed from inside the same process that holds the lock, so this
// spawns a real second (and third) process against a real file-system lock.
//
// Usage:
//   _lock-child.mjs <guard> hold <seconds>   acquire via <guard>'s withDatasetLock, print HELD,
//                                             sleep, release
//   _lock-child.mjs <guard> try  <seconds>   try to acquire via <guard>'s withDatasetLock for up
//                                             to N seconds; print ACQUIRED or TIMEOUT
//   _lock-child.mjs cross foreign-release <holderGuard> <releaserGuard>
//                                             <holderGuard> writes a live lock (its real
//                                             tryAcquire, real token); <releaserGuard> then calls
//                                             its own low-level release primitive with a
//                                             DIFFERENT, foreign token — simulating a delayed
//                                             release firing after that guard's own lock was
//                                             reaped and the other contract's guard took over the
//                                             shared path. Prints PROTECTED if the holder's lock
//                                             survives untouched, DELETED-BUG if it was removed.
//
// <guard> selects WHICH real contract's mutation guard runs the attempt:
//   cms-loop-f3        -> ./_mutation-guard.mjs (this contract's own guard)
//   show-visitor-info  -> ../show-visitor-info/_mutation-guard.mjs (the sibling contract's guard)
//
// SAOC_DOC_LOCK_PATH_OVERRIDE must be set by the caller — this must never touch the real lock.

const [guardName, mode, secondsArg] = process.argv.slice(2);

if (!process.env.SAOC_DOC_LOCK_PATH_OVERRIDE) {
  console.error('refusing to run without SAOC_DOC_LOCK_PATH_OVERRIDE — this helper must never touch the real lock');
  process.exit(1);
}

const GUARD_MODULES = {
  'cms-loop-f3': './_mutation-guard.mjs',
  'show-visitor-info': '../show-visitor-info/_mutation-guard.mjs',
};

if (guardName === 'cross' && mode === 'foreign-release') {
  const [holderGuard, releaserGuard] = process.argv.slice(4);
  const holderPath = GUARD_MODULES[holderGuard];
  const releaserPath = GUARD_MODULES[releaserGuard];
  if (!holderPath || !releaserPath) {
    console.error(`unknown guard pair ${JSON.stringify([holderGuard, releaserGuard])}`);
    process.exit(1);
  }
  const holder = await import(holderPath);
  const releaser = await import(releaserPath);

  const holderToken = `holder-${process.pid}-${Date.now()}`;
  const acquired = holder.tryAcquire(`cross-probe-holder-${holderGuard}`, holderToken);
  if (!acquired) {
    console.log('SETUP-FAILED: holder could not acquire a fresh sandbox lock');
    process.exit(1);
  }

  const foreignToken = `foreign-${process.pid}-${Date.now()}`;
  // The releaser's own release primitive is named differently per guard (releaseLock takes just
  // the token; releaseIfOurs also takes the owner name) — call whichever this module exports.
  if (typeof releaser.releaseLock === 'function') {
    releaser.releaseLock(foreignToken);
  } else if (typeof releaser.releaseIfOurs === 'function') {
    releaser.releaseIfOurs(`cross-probe-releaser-${releaserGuard}`, foreignToken, { quiet: true });
  } else {
    console.error(`${releaserGuard}'s guard exports neither releaseLock nor releaseIfOurs`);
    process.exit(1);
  }

  const survived = holder.readLock();
  if (survived && survived.token === holderToken) {
    console.log('PROTECTED');
  } else {
    console.log('DELETED-BUG');
  }
  process.exit(0);
}

const seconds = Number(secondsArg);
const modulePath = GUARD_MODULES[guardName];
if (!modulePath) {
  console.error(`unknown guard ${JSON.stringify(guardName)} — expected one of ${Object.keys(GUARD_MODULES).join(', ')}`);
  process.exit(1);
}

const { withDatasetLock } = await import(modulePath);

if (mode === 'hold') {
  await withDatasetLock(`lock-child-holder-${guardName}`, async () => {
    console.log('HELD');
    await new Promise((res) => setTimeout(res, seconds * 1000));
  });
  process.exit(0);
}

if (mode === 'try') {
  // A bounded attempt: the real wait timeout on both guards is minutes, which is not a test.
  const timer = setTimeout(() => {
    console.log('TIMEOUT');
    process.exit(0);
  }, seconds * 1000);
  timer.unref();
  await withDatasetLock(`lock-child-contender-${guardName}`, async () => {
    console.log('ACQUIRED');
  });
  process.exit(0);
}

console.error(`unknown mode ${JSON.stringify(mode)}`);
process.exit(1);
