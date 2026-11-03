// go-live-prep F6 / H12 -- end-to-end CLI refusal. Runs the real `seed` entry point in a scrubbed
// environment inside an in-project sandbox directory that holds no dotenv file, so the outcome
// cannot depend on the developer's own credentials. Offline: the live and unset cases must be
// refused before any credential is parsed or any network call is attempted, and the non-live
// control case dies on a deliberately unparseable key, locally, before any request leaves.
// Fails against main: there the live case reaches credential parsing and dies with a different message.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TSX = path.join(ROOT, 'node_modules/.bin/tsx');
const SCRIPT = path.join(ROOT, 'scripts/seed-door-test-tickets.ts');
const SANDBOX = path.join(ROOT, '.tmp/sandbox/f6-door-seed-cli');
const BAD_KEY = 'not-a-real-private-key';
const failures = [];

function run(label, env, extraArgs = []) {
  try {
    const stdout = execFileSync(TSX, [SCRIPT, 'seed', ...extraArgs], {
      cwd: SANDBOX,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function expectRefused(label, env, extraArgs) {
  const r = run(label, env, extraArgs);
  if (r.code === 0) failures.push(`${label}: exited 0, a seed ran`);
  if (!r.out.includes('door-seed refused:')) failures.push(`${label}: no "door-seed refused:" in output: ${r.out.slice(0, 300)}`);
  if (r.out.includes('Seeded ')) failures.push(`${label}: output claims a seed happened`);
}

rmSync(SANDBOX, { recursive: true, force: true });
mkdirSync(SANDBOX, { recursive: true });
if (existsSync(path.join(SANDBOX, '.env.local'))) failures.push('sandbox is not clean');

const creds = { FIREBASE_ADMIN_CLIENT_EMAIL: 'seed@example.invalid', FIREBASE_ADMIN_PRIVATE_KEY: BAD_KEY };
expectRefused('live id', { FIREBASE_ADMIN_PROJECT_ID: 'saoc-webapp', ...creds });
expectRefused('live id, mixed case and padding', { FIREBASE_ADMIN_PROJECT_ID: ' SAOC-WebApp ', ...creds });
expectRefused('id unset fails closed', { ...creds });
expectRefused('id blank fails closed', { FIREBASE_ADMIN_PROJECT_ID: '  ', ...creds });
expectRefused('no bypass flag: --force', { FIREBASE_ADMIN_PROJECT_ID: 'saoc-webapp', ...creds }, ['--force']);
expectRefused('no bypass flag: --allow-live', { FIREBASE_ADMIN_PROJECT_ID: 'saoc-webapp', ...creds }, ['--allow-live']);
expectRefused('no bypass env', { FIREBASE_ADMIN_PROJECT_ID: 'saoc-webapp', DOOR_SEED_ALLOW_LIVE: '1', FORCE: '1', ...creds });
expectRefused('service account of the live project', {
  FIREBASE_ADMIN_PROJECT_ID: 'saoc-door-fixture-test',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'seed@saoc-webapp.iam.gserviceaccount.com',
  FIREBASE_ADMIN_PRIVATE_KEY: BAD_KEY,
});

// Control: a non-live id is NOT refused by the guard (it fails later, on the bad key, locally).
const control = run('non-live control', { FIREBASE_ADMIN_PROJECT_ID: 'saoc-door-fixture-test', ...creds });
if (control.out.includes('door-seed refused:')) failures.push('control: a non-live project id was refused; the guard is a blanket block');
if (control.code === 0) failures.push('control: a seed with an unparseable key exited 0');

rmSync(SANDBOX, { recursive: true, force: true });
if (failures.length) {
  console.error(`FAIL door-seed-cli-refusal:\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log('PASS door-seed-cli-refusal');
