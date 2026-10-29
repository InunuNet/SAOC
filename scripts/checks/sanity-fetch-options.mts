// A6 (m3-f3-sanity-volume): buildSanityFetchOptions against the golden options table.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SANITY_REVALIDATE_SECONDS, buildSanityFetchOptions } from '../../sanity/lib/fetch.ts';

const TABLE_PATH =
  '.agent/memory/project/specs/backlog-wave-1028/m3-f3-sanity-volume/goldens/sanity-fetch-options-table.json';

interface Case {
  input: { isDraft: boolean; live: boolean; tags: string[] | null };
  expect: unknown;
}

const table = JSON.parse(readFileSync(TABLE_PATH, 'utf8')) as {
  constant: { SANITY_REVALIDATE_SECONDS: number };
  cases: Case[];
};

assert.equal(SANITY_REVALIDATE_SECONDS, table.constant.SANITY_REVALIDATE_SECONDS);
for (const [index, { input, expect }] of table.cases.entries()) {
  assert.deepEqual(buildSanityFetchOptions(input), expect, `case ${index}`);
}
console.log(`sanity-fetch-options: ${table.cases.length} cases ok`);
