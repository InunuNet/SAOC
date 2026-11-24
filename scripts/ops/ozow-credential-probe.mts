/**
 * Ozow credential probe (operator tool). Proves the three OZOW_SANDBOX_* values authenticate.
 *
 * Usage (run from the repo root):
 *   pnpm exec tsx --env-file=<path-to-env-file> scripts/ops/ozow-credential-probe.mts
 *
 * Network: real calls to Ozow only (api.ozow.com status API, pay.ozow.com hosted page). No
 * Firebase, no Sanity, no Firestore, no email. Nothing is written anywhere.
 *
 * Reads OZOW_SANDBOX_SITE_CODE, OZOW_SANDBOX_PRIVATE_KEY and OZOW_SANDBOX_API_KEY from process.env
 * only. It never prints a value, a prefix of a value, a hash, a request URL or a request body: it
 * prints lengths, booleans, HTTP statuses and Ozow's response text with every secret value
 * redacted first. All output goes through say(), which redacts.
 *
 * Where the values come from: process.env, and nothing else. `tsx --env-file` does NOT override a
 * variable already exported in your shell, and Node's env-file parser trims quotes and treats an
 * unquoted `#` as a comment before this script sees the value, so a standalone run can silently
 * test different values from the file. scripts/ops/push-ozow-keys-to-bundle.sh avoids both: it
 * parses the file strictly and runs this probe with exactly those three values in the child's
 * environment, overriding the parent shell. Use that script (--dry-run) when the file matters.
 *
 * Steps (each PASS / FAIL / INCONCLUSIVE). Observed Ozow behaviour (real run, 2026-11-24):
 * status endpoint answers 404 "No transactions found" for a valid key and unknown reference and
 * 401 "API key is invalid." for a bad key; the hosted page lands on /<guid>/secure/ for a correct
 * hash and /request-error for a wrong hash.
 *   1. Shape: present, non-empty, only [A-Za-z0-9-] (Ozow documents no issued character set;
 *      real values are 11, 32 and 32 characters). Reports the character CLASS, never a value.
 *   2. API key + site code: the adapter's own confirmNotification() (so the URL and ApiKey header
 *      are byte-for-byte what production sends) for a reference that does not exist, compared to
 *      a control call with a deliberately invalid API key. PASS only when the real call is HTTP
 *      404 (or 200) AND the control is HTTP 401. Real 401/403 is FAIL. Anything else is
 *      INCONCLUSIVE, with both statuses printed.
 *   3. Private key: the adapter's own initiate() builds the signed IsTest=true minimum-amount form
 *      and it is POSTed as a browser would, never paid. A control with a wrong HashCheck is posted
 *      too. PASS only when the correct hash does NOT land on /request-error and the wrong hash
 *      DOES. A probe transaction may appear as abandoned in the Ozow merchant admin; it is never
 *      completed.
 *
 * Exit codes: 0 all PASS, 1 any FAIL, 3 any INCONCLUSIVE (and no FAIL).
 */

import fs from 'node:fs';
import path from 'node:path';

import { createOzowProvider } from '../../lib/payments/ozow';

import type { ProviderNotification } from '../../lib/payments/types';

const EXIT_PASS = 0;
const EXIT_FAIL = 1;
const EXIT_INCONCLUSIVE = 3;

const KEY_NAMES = [
  'OZOW_SANDBOX_SITE_CODE',
  'OZOW_SANDBOX_PRIVATE_KEY',
  'OZOW_SANDBOX_API_KEY',
] as const;

const PROBE_AMOUNT = '0.01'; // same minimum the adminSettings/ozowSandboxTestMode override uses
const BOGUS_API_KEY = 'PROBE-INVALID-API-KEY';
const BOGUS_HASH = '0'.repeat(128);
const REQUEST_TIMEOUT_MS = 15_000;
const BODY_PREVIEW_MAX = 200;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const REQUEST_ERROR_PATH = '/request-error';
const APPHOSTING_PATH = path.resolve(import.meta.dirname, '../../apphosting.yaml');
const NOS_URL_VARIABLE = 'NEXT_PUBLIC_NOS_SITE_URL';

type Verdict = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

interface Outcome {
  readonly verdict: Verdict;
  readonly detail: string;
}

const secretValues: string[] = [];

/** Redact every known secret value from a line before it can reach stdout. */
function say(line: string): void {
  let safe = line;
  for (const value of secretValues) {
    if (value.length > 0) safe = safe.split(value).join('[redacted]');
  }
  process.stdout.write(`${safe}\n`);
}

function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : 'NonError';
  const message = error instanceof Error ? error.message : String(error);
  return `${name}: ${message}`;
}

/** Character CLASSES only, never the character. Quotes are caught by the charset rule. */
function shapeProblems(value: string | undefined): string[] {
  if (value === undefined) return ['missing'];
  const problems: string[] = [];
  if (value.length === 0) problems.push('empty');
  if (/[\r\n]/.test(value)) problems.push('CR/LF');
  if (/[ \t\f\v]/.test(value)) problems.push('whitespace');
  if (/["'`]/.test(value)) problems.push('quote');
  if (/#/.test(value)) problems.push('hash');
  if (/[^A-Za-z0-9\-\s"'`#]/.test(value)) problems.push('other');
  return problems;
}

function stepShape(env: Record<string, string | undefined>): Outcome {
  const failures: string[] = [];
  for (const name of KEY_NAMES) {
    const problems = shapeProblems(env[name]);
    const length = env[name]?.length ?? 0;
    say(`  ${name}: length ${length}${problems.length ? ` PROBLEMS: ${problems.join(', ')}` : ''}`);
    if (problems.length) failures.push(name);
  }
  return failures.length
    ? { verdict: 'FAIL', detail: `shape check failed for ${failures.join(', ')}` }
    : { verdict: 'PASS', detail: 'all three values have a clean shape' };
}

interface Recorded {
  status: number | null;
  text: string;
}

function recordingFetch(record: Recorded): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    record.status = response.status;
    record.text = (await response.clone().text()).slice(0, BODY_PREVIEW_MAX);
    return response;
  };
}

async function statusCall(
  env: Record<string, string | undefined>,
  reference: string
): Promise<Recorded> {
  const record: Recorded = { status: null, text: '' };
  const provider = createOzowProvider({ env, fetch: recordingFetch(record) });
  const notification: ProviderNotification = {
    reference,
    rawStatus: null,
    grossAmount: null,
    grossAmountCents: null,
    gatewayPaymentId: null,
    sourceIp: null,
    sourceIpTrusted: null,
    raw: { IsTest: 'true' },
  };
  await provider.confirmNotification(notification);
  return record;
}

async function stepApiKey(env: Record<string, string | undefined>): Promise<Outcome> {
  const reference = `PROBE-NOREF-${Date.now()}`;
  const real = await statusCall(env, reference);
  const control = await statusCall({ ...env, OZOW_SANDBOX_API_KEY: BOGUS_API_KEY }, reference);
  say(`  real key:    HTTP ${real.status} body: ${JSON.stringify(real.text)}`);
  say(`  invalid key: HTTP ${control.status} body: ${JSON.stringify(control.text)}`);
  if (real.status === null || control.status === null) {
    return { verdict: 'FAIL', detail: 'no HTTP response from the status endpoint' };
  }
  if (real.status === HTTP_UNAUTHORIZED || real.status === HTTP_FORBIDDEN) {
    return { verdict: 'FAIL', detail: `Ozow rejected the API key or site code (${real.status})` };
  }
  const statuses = `real ${real.status}, invalid-key control ${control.status}`;
  const realAccepted = real.status === HTTP_NOT_FOUND || real.status === HTTP_OK;
  if (realAccepted && control.status === HTTP_UNAUTHORIZED) {
    return { verdict: 'PASS', detail: `real key accepted, invalid key refused (${statuses})` };
  }
  return {
    verdict: 'INCONCLUSIVE',
    detail: `not the observed 404-or-200 versus 401 pattern (${statuses})`,
  };
}

function readNosOrigin(): string {
  const yaml = fs.readFileSync(APPHOSTING_PATH, 'utf8');
  const match = new RegExp(`variable: ${NOS_URL_VARIABLE}\\s+value: "([^"]+)"`).exec(yaml);
  if (!match) throw new Error(`${NOS_URL_VARIABLE} not found in apphosting.yaml`);
  return match[1].replace(/\/+$/, '');
}

interface PostOutcome {
  status: number;
  finalPath: string;
}

async function postForm(url: string, fields: Record<string, string>): Promise<PostOutcome> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
    redirect: 'follow',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  await response.arrayBuffer();
  return { status: response.status, finalPath: new URL(response.url).pathname };
}

async function stepPrivateKey(env: Record<string, string | undefined>): Promise<Outcome> {
  const origin = readNosOrigin();
  const reference = `PROBE-${Date.now()}`;
  const provider = createOzowProvider({ env });
  const built = await provider.initiate({
    reference,
    amountFormatted: PROBE_AMOUNT,
    itemName: 'Ozow credential probe',
    returnUrl: `${origin}/tickets/confirmation?ref=${reference}`,
    cancelUrl: `${origin}/tickets/cancelled?ref=${reference}`,
    notifyUrl: `${origin}/api/tickets/ozow-itn`,
  });
  if (!built.ok) return { verdict: 'FAIL', detail: 'adapter refused to build the request' };

  const good = await postForm(built.processUrl, { ...built.fields });
  const bad = await postForm(built.processUrl, { ...built.fields, HashCheck: BOGUS_HASH });
  say(`  correct hash: HTTP ${good.status} landed on path ${good.finalPath}`);
  say(`  wrong hash:   HTTP ${bad.status} landed on path ${bad.finalPath}`);

  const goodErrored = good.finalPath === REQUEST_ERROR_PATH;
  const badErrored = bad.finalPath === REQUEST_ERROR_PATH;
  if (good.status !== HTTP_OK || bad.status !== HTTP_OK) {
    return { verdict: 'INCONCLUSIVE', detail: 'a hosted-page response was not HTTP 200' };
  }
  if (goodErrored) {
    return { verdict: 'FAIL', detail: 'the correctly signed request landed on /request-error' };
  }
  if (!badErrored) {
    return {
      verdict: 'INCONCLUSIVE',
      detail: 'the wrong hash was not rejected, so accepting the correct hash proves nothing',
    };
  }
  return { verdict: 'PASS', detail: 'correct hash accepted; wrong hash landed on /request-error' };
}

async function runStep(name: string, step: () => Promise<Outcome>): Promise<Outcome> {
  say(name);
  let outcome: Outcome;
  try {
    outcome = await step();
  } catch (error) {
    outcome = { verdict: 'FAIL', detail: `error: ${describeError(error)}` };
  }
  say(`  => ${outcome.verdict}: ${outcome.detail}`);
  return outcome;
}

/** The adapter logs failed calls with error objects; the probe reports its own sanitised line. */
function silenceAdapterLogs(): void {
  console.error = () => undefined;
  console.warn = () => undefined;
}

async function main(): Promise<number> {
  silenceAdapterLogs();
  const env: Record<string, string | undefined> = {};
  for (const name of KEY_NAMES) {
    env[name] = process.env[name];
    const value = process.env[name];
    if (value) secretValues.push(value, value.trim());
  }

  const results: Outcome[] = [];
  const shape = await runStep('1. Shape check', async () => stepShape(env));
  results.push(shape);
  if (shape.verdict === 'FAIL') {
    say('Stopping: fix the value shape before any network call.');
    return EXIT_FAIL;
  }
  results.push(await runStep('2. API key and site code', () => stepApiKey(env)));
  results.push(await runStep('3. Private key (hash)', () => stepPrivateKey(env)));

  if (results.some((r) => r.verdict === 'FAIL')) return EXIT_FAIL;
  if (results.some((r) => r.verdict === 'INCONCLUSIVE')) return EXIT_INCONCLUSIVE;
  return EXIT_PASS;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    say(`probe aborted: ${describeError(error)}`);
    process.exit(EXIT_FAIL);
  }
);
