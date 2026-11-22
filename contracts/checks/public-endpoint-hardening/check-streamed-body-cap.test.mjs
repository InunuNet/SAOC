// Public-endpoint hardening: public JSON routes cap the bytes they actually read.
//
// readJsonBodyWithinLimit counts the body as it streams in, so a sender whose Content-Length
// understates the body (or who sends none) is still capped. A declared length that is
// non-numeric or over the cap is refused before anything is read.
//
// Run as: npx tsx --test contracts/checks/public-endpoint-hardening/check-streamed-body-cap.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  isDeclaredLengthWithinLimit,
  readJsonBodyWithinLimit,
} from '../../../lib/request-guards.ts';

const MAX = 64;
const encoder = new TextEncoder();

function jsonOfLength(bytes) {
  // {"a":"xxx"} is 8 bytes of framing around the filler.
  return JSON.stringify({ a: 'x'.repeat(bytes - 8) });
}

function post(body, headers = {}) {
  return new Request('http://localhost/api/x', { method: 'POST', headers, body });
}

function chunked(chunks, headers = {}) {
  let sent = 0;
  // highWaterMark 0: nothing is pulled until the reader asks.
  const stream = new ReadableStream(
    {
      pull(controller) {
        if (sent >= chunks.length) return controller.close();
        controller.enqueue(encoder.encode(chunks[sent]));
        sent += 1;
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request('http://localhost/api/x', {
    method: 'POST',
    headers,
    body: stream,
    duplex: 'half',
  });
  return { request, pulled: () => sent };
}

test('a body within the cap parses to its value', async () => {
  const body = jsonOfLength(32);
  const result = await readJsonBodyWithinLimit(post(body, { 'content-length': '32' }), MAX);
  assert.deepEqual(result, { ok: true, value: JSON.parse(body) });
});

test('a body of exactly the cap is accepted, one byte more is refused', async () => {
  const exact = jsonOfLength(MAX);
  assert.equal(encoder.encode(exact).byteLength, MAX);
  assert.equal((await readJsonBodyWithinLimit(post(exact), MAX)).ok, true);
  const over = jsonOfLength(MAX + 1);
  assert.deepEqual(await readJsonBodyWithinLimit(post(over), MAX), { ok: false, reason: 'too-large' });
});

test('a Content-Length that understates a larger body is still refused', async () => {
  const body = jsonOfLength(MAX * 4);
  const request = post(body, { 'content-length': '10' });
  assert.equal(request.headers.get('content-length'), '10');
  assert.deepEqual(await readJsonBodyWithinLimit(request, MAX), { ok: false, reason: 'too-large' });
});

test('a declared length over the cap, or not a plain integer, is refused unread', async () => {
  for (const declared of ['65', '-1', '10.5', 'abc', '']) {
    const { request, pulled } = chunked(['{}'], { 'content-length': declared });
    assert.deepEqual(
      await readJsonBodyWithinLimit(request, MAX),
      { ok: false, reason: 'too-large' },
      `declared ${JSON.stringify(declared)}`,
    );
    assert.equal(pulled(), 0, `declared ${JSON.stringify(declared)} was read`);
  }
});

test('a chunked body with no Content-Length is read and counted', async () => {
  const { request } = chunked(['{"a":', '"b"', '}']);
  assert.deepEqual(await readJsonBodyWithinLimit(request, MAX), { ok: true, value: { a: 'b' } });
});

test('an oversize chunked body is cut off while streaming', async () => {
  const { request, pulled } = chunked(Array.from({ length: 100 }, () => 'x'.repeat(32)));
  assert.deepEqual(await readJsonBodyWithinLimit(request, MAX), { ok: false, reason: 'too-large' });
  assert.ok(pulled() < 10, `stopped reading after ${pulled()} chunks`);
});

test('an oversize body is too-large even when cancelling the stream rejects', async () => {
  const stream = new ReadableStream(
    {
      pull(controller) {
        controller.enqueue(encoder.encode('x'.repeat(MAX + 1)));
      },
      cancel() {
        return Promise.reject(new Error('cancel failed'));
      },
    },
    { highWaterMark: 0 },
  );
  const request = new Request('http://localhost/api/x', { method: 'POST', body: stream, duplex: 'half' });
  assert.deepEqual(await readJsonBodyWithinLimit(request, MAX), { ok: false, reason: 'too-large' });
});

test('invalid JSON and an empty body are reported as invalid-json', async () => {
  for (const body of ['not json', '{"a":', '']) {
    assert.deepEqual(
      await readJsonBodyWithinLimit(post(body || null), MAX),
      { ok: false, reason: 'invalid-json' },
      JSON.stringify(body),
    );
  }
});

test('a multi-byte body is counted in bytes, not characters', async () => {
  const body = JSON.stringify({ a: 'é'.repeat(30) }); // 30 characters, 60 bytes: 69 bytes in all
  assert.ok(body.length < MAX && encoder.encode(body).byteLength > MAX);
  assert.deepEqual(await readJsonBodyWithinLimit(post(body), MAX), { ok: false, reason: 'too-large' });
});

test('isDeclaredLengthWithinLimit: missing passes, bad or oversize fails, exact passes', () => {
  assert.equal(isDeclaredLengthWithinLimit(null, MAX), true);
  assert.equal(isDeclaredLengthWithinLimit('0', MAX), true);
  assert.equal(isDeclaredLengthWithinLimit('64', MAX), true);
  for (const bad of ['65', '', 'abc', '-1', '10.5']) {
    assert.equal(isDeclaredLengthWithinLimit(bad, MAX), false, bad);
  }
});

const ROUTES = [
  'app/api/contact/route.ts',
  'app/api/events/submit/route.ts',
  'app/api/newsletter/preferences/route.ts',
  'app/api/newsletter/subscribe/route.ts',
  'app/api/newsletter/unsubscribe/route.ts',
  'app/api/newsletter/unsubscribe-email/route.ts',
  'app/api/sponsors/enquire/route.ts',
  'app/api/tickets/checkout/route.ts',
  'app/api/tickets/speakers-partner/auth/route.ts',
  'app/api/vendors/apply/route.ts',
  'app/api/vendors/register/route.ts',
  'app/api/vendors/register/verify-code/route.ts',
  'app/api/vendors/stand-payment/initiate/route.ts',
  'app/api/vendors/[id]/marketing-asset/route.ts',
  'app/api/vendors/[id]/proof-of-payment/route.ts',
];

for (const route of ROUTES) {
  test(`${route} reads its body through the streamed cap`, () => {
    const source = readFileSync(new URL(`../../../${route}`, import.meta.url), 'utf8');
    assert.match(source, /readJsonBodyWithinLimit\(|readBodyTextWithinLimit\(/);
    assert.doesNotMatch(source, /await (request|req)\.json\(\)|isBodyWithinLimit/);
  });
}

test('checkout keeps the rate limiter ahead of the body read', () => {
  const source = readFileSync(new URL('../../../app/api/tickets/checkout/route.ts', import.meta.url), 'utf8');
  const limiterAt = source.indexOf('consumeRateLimit(');
  const readAt = source.indexOf('readJsonBodyWithinLimit(request');
  assert.ok(limiterAt >= 0, 'consumeRateLimit( not found');
  assert.ok(readAt >= 0, 'readJsonBodyWithinLimit(request not found');
  assert.ok(limiterAt < readAt);
});
