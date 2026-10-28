// Negative controls for the two gates' verdict logic. Exits 1 if a verdict accepts a bad layout or rejects a good one, so neither gate can pass vacuously.
import { selftest as hub } from './hub-verdict.mjs';
import { selftest as lt1 } from './lt1-classify.mjs';
import { selftest as header } from './header-verdict.mjs';
import { selftest as todayStub } from './gen-today-stub.mjs';
import { FIXTURE_SRC } from './_lib.mjs';
import { selftest as breakpoint } from './breakpoint-diff.mjs';
import { selftest as spacedPath } from './spaced-path-control.mjs';
import { ROOT } from './_lib.mjs';
import { selftest as countdownFit, cssSelftest as countdownCss, tsxSelftest as countdownTsx } from './countdown-fit-verdict.mjs';
import { selftest as tnum } from './measure-tnum.mjs';

const bad = [...hub().map((s) => `hub: ${s}`), ...lt1().map((s) => `lt1: ${s}`), ...header().map((s) => `header: ${s}`), ...todayStub(FIXTURE_SRC).map((s) => `today stub: ${s}`), ...breakpoint().map((s) => `breakpoint diff: ${s}`), ...countdownFit().map((s) => `countdown fit: ${s}`), ...countdownCss().map((s) => `countdown css: ${s}`), ...countdownTsx().map((s) => `countdown tsx: ${s}`), ...tnum().map((s) => `tnum: ${s}`), ...spacedPath(FIXTURE_SRC, `${ROOT}/.tmp/sandbox/nos-hub-tablet-serif-gate`).map((s) => `spaced path: ${s}`)];
if (bad.length) { console.error(`selftest FAILED:\n- ${bad.join('\n- ')}`); process.exit(1); }
console.log('selftest pass (hub verdicts and the LT-1 classifier reject bad layouts and accept good ones)');
