// Shared by sanity-request-count.mjs and cache-headers-probe.mjs. Starts `next start` on a local
// port with a stubbed Sanity (every apicdn/api.sanity.io request is answered locally and counted
// by sanity-count-preload.mjs) and Firebase credentials blanked, so no live Sanity project or
// Firestore is ever touched. GET only.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const SANDBOX_DIR = resolve(REPO_ROOT, '.tmp/sandbox/sanity-count');
export const FETCH_CACHE_DIR = resolve(REPO_ROOT, '.next/cache/fetch-cache');

const PRELOAD_PATH = resolve(REPO_ROOT, 'scripts/checks/sanity-count-preload.mjs');
const NEXT_BIN = resolve(REPO_ROOT, 'node_modules/.bin/next');
const STUB_SANITY_PROJECT_ID = 'fakeproj';
const READY_TIMEOUT_SECONDS = 90;
const REQUEST_TIMEOUT_MS = 60000;
const SETTLE_MS = 500;
const BLANKED_FIREBASE_VARS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function stubbedEnv(port, countLog) {
  const blanked = Object.fromEntries(BLANKED_FIREBASE_VARS.map((name) => [name, '']));
  return {
    ...process.env,
    ...blanked,
    // A file URL percent-encodes spaces; NODE_OPTIONS splits on bare spaces, so a raw path breaks.
    NODE_OPTIONS: `--import ${pathToFileURL(PRELOAD_PATH).href}`,
    SANITY_COUNT_LOG: countLog,
    NEXT_PUBLIC_SANITY_PROJECT_ID: STUB_SANITY_PROJECT_ID,
    NEXT_PUBLIC_SAOC_SITE_URL: `http://saoc.localhost:${port}`,
    NEXT_PUBLIC_NOS_SITE_URL: `http://nos.localhost:${port}`,
    SITE_URL: `http://saoc.localhost:${port}`,
  };
}

export function resetCountLog(countLog) {
  mkdirSync(SANDBOX_DIR, { recursive: true });
  writeFileSync(countLog, '');
}

export function clearFetchCache() {
  rmSync(FETCH_CACHE_DIR, { recursive: true, force: true });
}

export function countLines(countLog) {
  if (!existsSync(countLog)) return 0;
  return readFileSync(countLog, 'utf8').split('\n').filter(Boolean).length;
}

// The count-log lines appended after the first `before` lines (a prior countLines value).
export function linesSince(countLog, before) {
  if (!existsSync(countLog)) return [];
  return readFileSync(countLog, 'utf8').split('\n').filter(Boolean).slice(before);
}

export function get(port, host, path, { headers = {}, wantBody = false } = {}) {
  return new Promise((done) => {
    const request = http.request(
      { host: '127.0.0.1', port, path, method: 'GET', headers: { host, ...headers } },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => (wantBody ? chunks.push(chunk) : undefined));
        response.on('end', () =>
          done({
            status: response.statusCode,
            cacheControl: response.headers['cache-control'] ?? null,
            location: response.headers.location ?? null,
            body: wantBody ? Buffer.concat(chunks).toString('utf8') : '',
          }),
        );
      },
    );
    request.on('error', () => done({ status: 0, cacheControl: null, body: '' }));
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy());
    request.end();
  });
}

export async function startServer({ port, countLog, launched }) {
  resetCountLog(countLog);
  clearFetchCache();
  const env = { ...stubbedEnv(port, countLog), NODE_ENV: 'production' };
  if (launched) env.SITE_PUBLIC_LAUNCH = 'true';
  const server = spawn(NEXT_BIN, ['start', '-p', String(port)], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env,
  });
  const stop = () => server.kill();
  for (let attempt = 0; attempt < READY_TIMEOUT_SECONDS; attempt += 1) {
    const probe = await get(port, `saoc.localhost:${port}`, '/privacy');
    if (probe.status) return { stop, hostFor: (site) => `${site}.localhost:${port}` };
    await sleep(1000);
  }
  stop();
  throw new Error(`next start on port ${port} not ready after ${READY_TIMEOUT_SECONDS}s`);
}

// One request, then a short settle so a background revalidation it triggered is counted against it.
export async function countedGet(port, countLog, host, path, options) {
  const before = countLines(countLog);
  const response = await get(port, host, path, options);
  await sleep(SETTLE_MS);
  return { ...response, requests: countLines(countLog) - before };
}
