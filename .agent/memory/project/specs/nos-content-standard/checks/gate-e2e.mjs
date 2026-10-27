// A17: the CI e2e step, run as CI runs it (`bash scripts/ci-e2e.sh pnpm test:e2e`, the literal command of .github/workflows/ci.yml "E2E tests"),
// under the Sanity fixture in replay with the net guard. The suite starts its own `next dev` (playwright.config.ts webServer, dynamic port), which
// inherits this process's environment, so SANITY_FIXTURE_* and the NODE_OPTIONS --require guard reach it. Pass = the suite exits 0 AND the fixture
// logs show it served reads from the fixture, with zero misses (a replay miss is loud: the suite or this proof fails) and zero Sanity API traffic.
// No server of ours is started; the suite owns its dev server and Playwright stops it. Run from the repo root of the dev's worktree, after A15.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { collector, fixtureEnv, fixtureProof, FIXTURE_MODE, BASE_PORT } from './_lib.mjs';

const E2E_CMD = ['bash', 'scripts/ci-e2e.sh', 'pnpm', 'test:e2e'];
const E2E_TIMEOUT_MS = 25 * 60 * 1000;
const LOG_OFFSET = 4; // fixture-logs-<BASE+4>; the browser gates own offsets 1-3

const c = collector('A17 ci-e2e');
if (FIXTURE_MODE === 'live') { console.error('A17 FAILED: NOS_STD_FIXTURE=live opts out of the fixture; the e2e step must run under replay'); process.exit(1); }
// CI's e2e step has no .env, so the app would never construct a Sanity client (0 hits, empty _started.log). These two PUBLIC values are read from apphosting.yaml, never hard-coded.
const apphosting = readFileSync('apphosting.yaml', 'utf8');
const publicSanity = {};
for (const name of ['NEXT_PUBLIC_SANITY_PROJECT_ID', 'NEXT_PUBLIC_SANITY_DATASET']) {
  const v = (apphosting.match(new RegExp(`variable: ${name}\\s*\\n\\s*value:\\s*"?([^"\\n]+)"?`)) ?? [])[1];
  if (!v) { console.error(`A17 FAILED: apphosting.yaml has no value for ${name}`); process.exit(1); }
  publicSanity[name] = v;
}
const env = { ...process.env, CI: '1', ...publicSanity, ...fixtureEnv(BASE_PORT + LOG_OFFSET) };
delete env.K_SERVICE; // the fixture is inert on the hosted runtime; this gate is never hosted
delete env.SAOC_E2E_DYNAMIC_PORT; // playwright.config.ts caches its free port here; a stale value from a parent shell would pin a busy one
const r = spawnSync(E2E_CMD[0], E2E_CMD.slice(1), { env, stdio: 'inherit', timeout: E2E_TIMEOUT_MS });
c.check(`\`${E2E_CMD.join(' ')}\` exited 0 (status ${r.status}, signal ${r.signal ?? 'none'}${r.error ? `, ${r.error.message}` : ''})`, r.status === 0);
fixtureProof({ port: BASE_PORT + LOG_OFFSET }, c);
c.finish(null);
