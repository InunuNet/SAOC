// Shared guard: every module a check can import from this harness loads this first. The flag is
// an in-process symbol that only preload.cjs sets, at the point it installs the stubs; an
// environment variable would let `VAR=1 node check.mjs` skip the stubs and would leak into
// child processes.
export const PRELOAD_FLAG = Symbol.for('saoc.route-runner.preload');

if (globalThis[PRELOAD_FLAG] !== true) {
  throw new Error(
    'route-runner: preload.cjs is not loaded. Run with NODE_OPTIONS="--require ' +
      '$PWD/contracts/harness/route-runner/preload.cjs"; without it Firebase is not stubbed.',
  );
}
