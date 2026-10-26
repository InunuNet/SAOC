// e2e/sanity-fetch-fixture-miss.spec.ts
// Unit-style, no browser and no server (same convention as beta-password-wall-decision.spec.ts).
// sanityFetch must not turn a Sanity fixture replay miss into the graceful `null` fallback, must keep
// that fallback for every other failure when the fixture is off, and record mode must refuse
// credential-named params before any fetch. The real next-sanity client is never loaded: withFixture
// wraps any client, so a stub stands in, and sanityFetch is given the stub through the module cache.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { SanityFixtureMiss, withFixture } from '../lib/sanity-fixture';

const FIXTURE_ENV_KEYS = [
  'SANITY_FIXTURE_MODE',
  'SANITY_FIXTURE_DIR',
  'SANITY_FIXTURE_LOGDIR',
  'SANITY_FIXTURE_RECORD_CONFIRM',
  'K_SERVICE',
];
const FETCH_MODULE = path.join('sanity', 'lib', 'fetch');

type StubClient = {
  fetch: (query: string, params?: Record<string, unknown>) => Promise<unknown>;
  withConfig: () => StubClient;
  clone: () => StubClient;
  config: () => Record<string, unknown>;
};
type FetchModule = typeof import('../sanity/lib/fetch');

/** A client whose reads always fail, and which counts how many reads were attempted. */
function failingClient(): { client: StubClient; reads: () => number } {
  let reads = 0;
  const client: StubClient = {
    fetch: () => {
      reads += 1;
      return Promise.reject(new Error('network down'));
    },
    withConfig: () => client,
    clone: () => client,
    config: () => ({}),
  };
  return { client, reads: () => reads };
}

/** Loads sanity/lib/fetch.ts against a stub './client' module, so next-sanity is never imported. */
async function loadFetchWith(client: StubClient): Promise<FetchModule> {
  const clientId = require.resolve('../sanity/lib/client');
  require.cache[clientId] = {
    id: clientId,
    filename: clientId,
    loaded: true,
    exports: { client },
  } as unknown as NodeJS.Module; // a minimal cache entry: only `exports` is read by importers
  for (const id of Object.keys(require.cache)) {
    if (id.includes(FETCH_MODULE)) delete require.cache[id];
  }
  return import('../sanity/lib/fetch');
}

test.describe('sanityFetch and the Sanity fixture', () => {
  const saved: Record<string, string | undefined> = {};
  let dir = '';

  test.beforeEach(() => {
    for (const key of FIXTURE_ENV_KEYS) saved[key] = process.env[key];
    for (const key of FIXTURE_ENV_KEYS) delete process.env[key];
    dir = mkdtempSync(path.join(tmpdir(), 'sanity-fixture-miss-'));
  });

  test.afterEach(() => {
    for (const key of FIXTURE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    delete require.cache[require.resolve('../sanity/lib/client')];
    rmSync(dir, { recursive: true, force: true });
  });

  test('replay with an empty fixture dir rejects with SanityFixtureMiss, not null', async () => {
    process.env.SANITY_FIXTURE_MODE = 'replay';
    process.env.SANITY_FIXTURE_DIR = dir;
    process.env.SANITY_FIXTURE_LOGDIR = dir;
    const { client, reads } = failingClient();
    const { sanityFetch } = await loadFetchWith(withFixture(client));

    await expect(sanityFetch({ query: '*[_type == "absentFixtureQuery"][0]' })).rejects.toBeInstanceOf(
      SanityFixtureMiss,
    );
    expect(reads()).toBe(0);
  });

  test('record mode refuses a nested credential-named param before any fetch', async () => {
    process.env.SANITY_FIXTURE_MODE = 'record';
    process.env.SANITY_FIXTURE_RECORD_CONFIRM = '1';
    process.env.SANITY_FIXTURE_DIR = dir;
    process.env.SANITY_FIXTURE_LOGDIR = dir;
    const { client, reads } = failingClient();
    const recording = withFixture(client);

    await expect(
      recording.fetch('*[_type == "x"]', { filter: { apiKey: 'x' } }),
    ).rejects.toThrow(/refuses a param named "apiKey"/);
    await expect(
      recording.fetch('*[_type == "x"]', { list: [{ inner: { password: 'x' } }] }),
    ).rejects.toThrow(/refuses a param named "password"/);
    expect(reads()).toBe(0);
    expect(readdirSync(dir).filter((name) => name.endsWith('.json'))).toEqual([]);
  });

  test('with the fixture off a failed fetch still resolves to null', async () => {
    const { client, reads } = failingClient();
    const { sanityFetch } = await loadFetchWith(withFixture(client));

    await expect(sanityFetch({ query: '*[0]' })).resolves.toBeNull();
    expect(reads()).toBe(1);
  });
});
