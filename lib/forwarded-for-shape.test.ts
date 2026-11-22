import assert from 'node:assert/strict';
import test from 'node:test';

import { describeForwardedForShape } from './forwarded-for-shape';

function headersOf(values: Record<string, string>) {
  return { get: (name: string): string | null => values[name.toLowerCase()] ?? null };
}

const ADDRESS_LIKE = /\d{1,3}(\.\d{1,3}){3}|[0-9a-f]{1,4}(:[0-9a-f]{0,4}){2,}/i;

test('absent headers give an empty shape', () => {
  assert.deepEqual(describeForwardedForShape(headersOf({})), {
    hopCount: 0,
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
