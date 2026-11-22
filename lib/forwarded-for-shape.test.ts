import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLogBudget,
  describeForwardedForShape,
  MAX_FAMILY_HOPS,
  MAX_HEADER_CHARS,
} from './forwarded-for-shape';

function headersOf(values: Record<string, string>) {
  return { get: (name: string): string | null => values[name.toLowerCase()] ?? null };
}

const ADDRESS_LIKE = /\d{1,3}(\.\d{1,3}){3}|[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,}/i;

test('absent headers give an empty shape', () => {
  assert.deepEqual(describeForwardedForShape(headersOf({})), {
    hopCount: 0,
    oversize: false,
    fahPresent: false,
    fahMatchesHopFromEnd: null,
    probeMatchesHopFromEnd: null,
    fahEqualsProbe: false,
    hopFamilies: [],
    realIpPresent: false,
  });
});

test('two hops: count and families', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '203.0.113.5, 66.249.1.1' }),
  );
  assert.equal(shape.hopCount, 2);
  assert.deepEqual(shape.hopFamilies, ['v4', 'v4']);
  assert.equal(shape.probeMatchesHopFromEnd, null);
});

test('three hops with the probe address third from the end', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '198.51.100.7, 66.249.1.1, 74.125.1.1' }),
  );
  assert.equal(shape.hopCount, 3);
  assert.equal(shape.probeMatchesHopFromEnd, 3);
});

test('four hops with the probe address first', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '198.51.100.7, 203.0.113.5, 66.249.1.1, 74.125.1.1' }),
  );
  assert.equal(shape.hopCount, 4);
  assert.equal(shape.probeMatchesHopFromEnd, 4);
});

test('x-fah-client-ip matching hop 3 from the end', () => {
  const shape = describeForwardedForShape(
    headersOf({
      'x-forwarded-for': '192.0.2.1, 203.0.113.5, 66.249.1.1, 74.125.1.1',
      'x-fah-client-ip': '203.0.113.5',
    }),
  );
  assert.equal(shape.fahPresent, true);
  assert.equal(shape.fahMatchesHopFromEnd, 3);
  assert.equal(shape.fahEqualsProbe, false);
});

test('spoofed x-fah-client-ip is reported as equal to the probe value', () => {
  const shape = describeForwardedForShape(
    headersOf({
      'x-forwarded-for': '198.51.100.7, 203.0.113.5, 66.249.1.1',
      'x-fah-client-ip': '198.51.100.9',
    }),
  );
  assert.equal(shape.fahEqualsProbe, true);
  assert.equal(shape.fahMatchesHopFromEnd, null);
});

test('IPv6 and unrecognised hops are classified by family', () => {
  const shape = describeForwardedForShape(
    headersOf({
      'x-forwarded-for': '2001:db8:1:2::5, ::ffff:192.0.2.1, unknown, 66.249.1.1',
      'x-real-ip': '203.0.113.5',
    }),
  );
  assert.deepEqual(shape.hopFamilies, ['v6', 'v6', 'other', 'v4']);
  assert.equal(shape.realIpPresent, true);
});

test('the serialised shape never contains an address', () => {
  const shape = describeForwardedForShape(
    headersOf({
      'x-forwarded-for': '198.51.100.7, 2001:db8:1:2::5, 203.0.113.5, 66.249.1.1',
      'x-fah-client-ip': '203.0.113.5',
      'x-real-ip': '203.0.113.5',
    }),
  );
  assert.doesNotMatch(JSON.stringify(shape), ADDRESS_LIKE);
});

test('colon flood with a trailing non-hex char is oversize and not parsed', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': `${':'.repeat(15000)}g` }),
  );
  assert.equal(shape.oversize, true);
  assert.equal(shape.hopCount, 0);
  assert.deepEqual(shape.hopFamilies, []);
});

test('a short colon run classifies as other without trouble', () => {
  const shape = describeForwardedForShape(headersOf({ 'x-forwarded-for': `${':'.repeat(200)}g` }));
  assert.equal(shape.oversize, false);
  assert.deepEqual(shape.hopFamilies, ['other']);
});

test('thousands of hops are oversize: no split, empty families', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '1,'.repeat(7500) + '1' }),
  );
  assert.equal(shape.oversize, true);
  assert.equal(shape.hopCount, 0);
  assert.deepEqual(shape.hopFamilies, []);
  assert.ok(JSON.stringify(shape).length < MAX_HEADER_CHARS);
});

test('over-long x-fah-client-ip is treated as absent and flagged oversize', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '203.0.113.5', 'x-fah-client-ip': 'a'.repeat(513) }),
  );
  assert.equal(shape.oversize, true);
  assert.equal(shape.fahPresent, false);
  assert.equal(shape.fahMatchesHopFromEnd, null);
  assert.equal(shape.hopCount, 1);
});

test('a value of exactly the limit is still parsed', () => {
  const chain = `${'1,'.repeat(MAX_HEADER_CHARS / 2 - 1)}1`;
  assert.ok(chain.length <= MAX_HEADER_CHARS);
  const shape = describeForwardedForShape(headersOf({ 'x-forwarded-for': chain }));
  assert.equal(shape.oversize, false);
  assert.equal(shape.hopCount, MAX_HEADER_CHARS / 2);
});

test('hopFamilies keeps only the last 8 hops while hopCount stays exact', () => {
  const hops = ['10.0.0.1', '10.0.0.2', '10.0.0.3', '::1', 'x', '10.0.0.4', '10.0.0.5',
    '10.0.0.6', '10.0.0.7', '10.0.0.8', '2001:db8::1'];
  const shape = describeForwardedForShape(headersOf({ 'x-forwarded-for': hops.join(', ') }));
  assert.equal(shape.hopCount, hops.length);
  assert.equal(shape.hopFamilies.length, MAX_FAMILY_HOPS);
  assert.deepEqual(shape.hopFamilies, ['v6', 'other', 'v4', 'v4', 'v4', 'v4', 'v4', 'v6']);
});

test('malformed values are other: out-of-range v4, bare colon, v4 with port', () => {
  const shape = describeForwardedForShape(
    headersOf({ 'x-forwarded-for': '999.999.999.999, :, 203.0.113.5:8080, 203.0.113.5' }),
  );
  assert.deepEqual(shape.hopFamilies, ['other', 'other', 'other', 'v4']);
});

test('log budget allows exactly the configured number of lines', () => {
  const budget = createLogBudget(3);
  assert.deepEqual([1, 2, 3, 4, 5].map(() => budget.tryTake()), [true, true, true, false, false]);
});
