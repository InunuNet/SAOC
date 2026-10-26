// e2e/sanity-fetch-fixture-miss.spec.ts
// Unit-style, no browser and no server (same convention as beta-password-wall-decision.spec.ts).
// sanityFetch must not turn a Sanity fixture replay miss into the graceful `null` fallback, and
// must keep that fallback for every other failure when the fixture is off.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

const FIXTURE_ENV_KEYS = [
  'SANITY_FIXTURE_MODE',
  'SANITY_FIXTURE_DIR',
  'SANITY_FIXTURE_LOGDIR',
  'SANITY_FIXTURE_RECORD_CONFIRM',
  'K_SERVICE',
  'NEXT_PUBLIC_SANITY_PROJECT_ID',
];
const MODULE_MARKERS = ['sanity/lib/', 'lib/sanity-fixture', 'sanity/env'].map((marker) =>
  marker.split('/').join(path.sep),
);

type FetchModule = typeof import('../sanity/lib/fetch');

/** Loads sanity/lib/fetch.ts afresh, because client.ts reads the environment at import time. */
async function loadFreshFetch(): Promise<FetchModule> {
  for (const id of Object.keys(require.cache)) {
    if (MODULE_MARKERS.some((marker) => id.includes(marker))) delete require.cache[id];
  }
  return import('../sanity/lib/fetch');
}

test.describe('sanityFetch and the Sanity fixture', () => {
  const saved: Record<string, string | undefined> = {};
  let emptyDir = '';

  test.beforeEach(() => {
    for (const key of FIXTURE_ENV_KEYS) saved[key] = process.env[key];
    for (const key of FIXTURE_ENV_KEYS) delete process.env[key];
    emptyDir = mkdtempSync(path.join(tmpdir(), 'sanity-fixture-miss-'));
  });

  test.afterEach(() => {
    for (const key of FIXTURE_ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(emptyDir, { recursive: true, force: true });
  });

  test('replay with an empty fixture dir rejects with SanityFixtureMiss, not null', async () => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'fixturetest';
    process.env.SANITY_FIXTURE_MODE = 'replay';
    process.env.SANITY_FIXTURE_DIR = emptyDir;
    process.env.SANITY_FIXTURE_LOGDIR = emptyDir;
    const { sanityFetch } = await loadFreshFetch();
    const { SanityFixtureMiss } = await import('../lib/sanity-fixture');

    await expect(sanityFetch({ query: '*[_type == "absentFixtureQuery"][0]' })).rejects.toBeInstanceOf(
      SanityFixtureMiss,
    );
  });

  test('record mode refuses a nested credential-named param before any fetch', async () => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'fixturetest';
    process.env.SANITY_FIXTURE_MODE = 'record';
    process.env.SANITY_FIXTURE_RECORD_CONFIRM = '1';
    process.env.SANITY_FIXTURE_DIR = emptyDir;
    process.env.SANITY_FIXTURE_LOGDIR = emptyDir;
    await loadFreshFetch();
    const { client } = await import('../sanity/lib/client');
    expect(client).not.toBeNull();

    await expect(
      client!.fetch('*[_type == "x"]', { filter: { apiKey: 'x' } }),
    ).rejects.toThrow(/refuses a param named "apiKey"/);
    await expect(
      client!.fetch('*[_type == "x"]', { list: [{ inner: { password: 'x' } }] }),
    ).rejects.toThrow(/refuses a param named "password"/);
    expect(readdirSync(emptyDir).filter((name) => name.endsWith('.json'))).toEqual([]);
  });

  test('with the fixture off a failed fetch still resolves to null', async () => {
    process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'fixturetest';
    const { sanityFetch } = await loadFreshFetch();
    const { client } = await import('../sanity/lib/client'); // the instance sanityFetch closed over
    expect(client).not.toBeNull();
    const original = client!.fetch;
    client!.fetch = (() => Promise.reject(new Error('network down'))) as NonNullable<typeof client>['fetch'];
    try {
      await expect(sanityFetch({ query: '*[0]' })).resolves.toBeNull();
    } finally {
      client!.fetch = original;
    }
  });
});
