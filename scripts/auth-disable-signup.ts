/**
 * SEC-03: disable client-SDK signup on the Firebase Auth project.
 *
 * Sets Identity Toolkit Admin v2 `projects/<project>/config` field
 * `client.permissions.disabledUserSignup`. The Admin SDK path used by scripts/admin-grant.ts
 * (`createUser()`) is not subject to this flag, so admin provisioning keeps working.
 *
 * Modes:
 *   (default)               dry-run: GET, print current and target, change nothing
 *   --apply                 PATCH the single leaf field, then GET to read it back
 *   --verify                GET only; exit 0 iff signup is disabled
 *   --target false          with --apply: roll back (re-enable signup)
 *   --config-fixture <file> offline dry-run against a canned config; refused with --apply/--verify
 *
 * The config response holds `signIn.hashConfig.signerKey`, so this script projects the one
 * boolean it needs and discards the rest. Nothing else from the body is ever printed or logged.
 *
 * Credential: operator access token (`gcloud auth print-access-token`), not the service account
 * key in .env.local. Exit codes: 0 ok, 1 usage/failed read-back/verify false, 3 API rejected the
 * change (for example Identity Platform not upgraded).
 *
 * Run with: pnpm exec tsx scripts/auth-disable-signup.ts [--apply] [--verify] [--target false]
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROJECT_ID = 'saoc-webapp';
const CONFIG_URL = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config`;
const UPDATE_MASK = 'client.permissions.disabledUserSignup';
const EXIT_FAILED = 1;
const EXIT_API_REJECTED = 3;

class ApiRejectedError extends Error {}

interface ParsedArgs {
  apply: boolean;
  verify: boolean;
  target: boolean;
  fixture?: string;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = { apply: false, verify: false, target: true };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      parsed.apply = true;
    } else if (arg === '--verify') {
      parsed.verify = true;
    } else if (arg === '--target') {
      i += 1;
      const value = argv[i];
      if (value !== 'true' && value !== 'false') {
        throw new Error('--target must be "true" or "false"');
      }
      parsed.target = value === 'true';
    } else if (arg === '--config-fixture') {
      i += 1;
      parsed.fixture = argv[i];
      if (!parsed.fixture) throw new Error('--config-fixture needs a file path');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (parsed.fixture && (parsed.apply || parsed.verify)) {
    throw new Error('--config-fixture is offline only and cannot be combined with --apply or --verify');
  }
  if (parsed.apply && parsed.verify) {
    throw new Error('--apply and --verify are separate modes');
  }
  return parsed;
}

/** Projects the one boolean we need; everything else in the body is discarded. */
function projectSignupDisabled(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const client = (body as { client?: unknown }).client;
  if (typeof client !== 'object' || client === null) return false;
  const permissions = (client as { permissions?: unknown }).permissions;
  if (typeof permissions !== 'object' || permissions === null) return false;
  return (permissions as { disabledUserSignup?: unknown }).disabledUserSignup === true;
}

function getAccessToken(): string {
  const token = execFileSync('gcloud', ['auth', 'print-access-token'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  if (!token) throw new Error('gcloud returned an empty access token; run `gcloud auth login`');
  return token;
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'x-goog-user-project': PROJECT_ID,
    'Content-Type': 'application/json',
  };
}

/** Throws ApiRejectedError carrying the HTTP status only, never the response body. */
async function expectOk(res: Response, operation: string): Promise<unknown> {
  if (!res.ok) {
    throw new ApiRejectedError(`${operation} rejected by API: HTTP ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function readLive(token: string): Promise<boolean> {
  const res = await fetch(CONFIG_URL, { headers: authHeaders(token) });
  return projectSignupDisabled(await expectOk(res, 'GET config'));
}

async function patchLive(token: string, target: boolean): Promise<void> {
  const res = await fetch(`${CONFIG_URL}?updateMask=client.permissions.disabledUserSignup`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ client: { permissions: { disabledUserSignup: target } } }),
  });
  await expectOk(res, 'PATCH config');
}

function reportDryRun(current: boolean, target: boolean): void {
  if (current === target) {
    console.log(`ALREADY ${UPDATE_MASK}=${current}; nothing to change.`);
  } else {
    console.log(`WOULD SET ${UPDATE_MASK}: ${current} -> ${target} (dry-run, nothing written).`);
  }
}

async function runApply(token: string, target: boolean): Promise<number> {
  const current = await readLive(token);
  if (current === target) {
    console.log(`ALREADY ${UPDATE_MASK}=${current}; no PATCH sent.`);
    return 0;
  }
  await patchLive(token, target);
  const readBack = await readLive(token);
  if (readBack !== target) {
    console.error(`FAILED read-back: ${UPDATE_MASK}=${readBack}, expected ${target}.`);
    return EXIT_FAILED;
  }
  console.log(`SET ${UPDATE_MASK}: ${current} -> ${readBack} (read back and confirmed).`);
  return 0;
}

async function run(args: ParsedArgs): Promise<number> {
  if (args.fixture) {
    reportDryRun(projectSignupDisabled(JSON.parse(readFileSync(args.fixture, 'utf8'))), args.target);
    return 0;
  }
  const token = getAccessToken();
  if (args.verify) {
    const current = await readLive(token);
    console.log(`${UPDATE_MASK}=${current}`);
    return current ? 0 : EXIT_FAILED;
  }
  if (args.apply) return runApply(token, args.target);
  reportDryRun(await readLive(token), args.target);
  return 0;
}

async function main(): Promise<void> {
  try {
    process.exitCode = await run(parseArgs(process.argv.slice(2)));
  } catch (err: unknown) {
    if (err instanceof ApiRejectedError) {
      console.error(
        `auth-disable-signup: ${err.message}. If this is the PATCH, the project may need the ` +
          'Identity Platform upgrade; do not upgrade without Brad. The events/submit route gate ' +
          'still closes SEC-03 on its own.',
      );
      process.exitCode = EXIT_API_REJECTED;
      return;
    }
    console.error(`auth-disable-signup failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = EXIT_FAILED;
  }
}

void main();
