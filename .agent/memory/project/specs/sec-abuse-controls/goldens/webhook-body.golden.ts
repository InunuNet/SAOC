// Golden for lib/webhook-body.ts (SEC-17): bounded body read for the exempt ITN routes.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/webhook-body.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const CAP = 16384;

function streamRequest(chunks: Uint8Array[], headers: Record<string, string> = {}, rejectCancel = false) {
  const probe = { pulls: 0, pulledBytes: 0, cancelled: false };
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      probe.pulls += 1;
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[index++];
      probe.pulledBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      probe.cancelled = true;
      if (rejectCancel) return Promise.reject(new Error('cancel refused'));
    },
  });
  const request = new Request('http://localhost/api/tickets/itn', {
    method: 'POST',
    body,
    headers,
    // @ts-expect-error duplex is required by undici for stream bodies
    duplex: 'half',
  });
  return { request, probe };
}

const bytes = (n: number, fill = 0x61) => new Uint8Array(n).fill(fill);

async function main() {
  const mod = await import(path.join(ROOT, 'lib/webhook-body.ts'));
  const { readCappedBody, WEBHOOK_MAX_BODY_BYTES } = mod;

  assert.equal(WEBHOOK_MAX_BODY_BYTES, CAP, 'cap is 16 KiB (spec.md D6)');

  // 1. A declared Content-Length over the cap is refused without consuming the stream (a
  //    ReadableStream pre-pulls at most its high-water mark, so allow two chunks of read-ahead).
  {
    const chunks = Array.from({ length: 8 }, () => bytes(4096));
    const { request, probe } = streamRequest(chunks, { 'content-length': String(CAP + 1) });
    const result = await readCappedBody(request);
    assert.equal(result.ok, false);
    assert.ok(probe.pulledBytes <= 8192, `must not consume the body, read ${probe.pulledBytes}`);
    assert.equal(probe.cancelled, true, 'the refused request body stream must be cancelled, not left open');
  }

  // 2. No Content-Length (chunked): the stream is cut off at the cap and cancelled.
  {
    const chunks = Array.from({ length: 8 }, () => bytes(4096)); // 32 KiB total
    const { request, probe } = streamRequest(chunks);
    const result = await readCappedBody(request);
    assert.equal(result.ok, false);
    assert.ok(probe.pulledBytes <= CAP + 4096, `read at most cap + one chunk, read ${probe.pulledBytes}`);
    assert.equal(probe.cancelled, true, 'the upstream stream must be cancelled once the cap is exceeded');
  }

  // 3. A lying Content-Length (under-declared) cannot smuggle a large body past the stream cap.
  {
    const chunks = Array.from({ length: 8 }, () => bytes(4096));
    const { request, probe } = streamRequest(chunks, { 'content-length': '10' });
    const result = await readCappedBody(request);
    assert.equal(result.ok, false);
    assert.ok(probe.pulledBytes <= CAP + 4096);
  }

  // 4. Exactly the cap is accepted; empty and absent bodies are accepted as empty text.
  {
    const exact = await readCappedBody(streamRequest([bytes(CAP / 2), bytes(CAP / 2)]).request);
    assert.ok(exact.ok && exact.text.length === CAP);
    const empty = await readCappedBody(streamRequest([]).request);
    assert.ok(empty.ok && empty.text === '');
    const noBody = await readCappedBody(new Request('http://localhost/x', { method: 'POST' }));
    assert.ok(noBody.ok && noBody.text === '');
  }

  // 5. Text is decoded as UTF-8 across chunk boundaries (a split multibyte character survives).
  {
    const euro = new TextEncoder().encode('amount=€12');
    const split = streamRequest([euro.slice(0, 9), euro.slice(9)]).request;
    const result = await readCappedBody(split);
    assert.ok(result.ok && result.text === 'amount=€12');
  }

  // 6. Real, form-encoded worst cases (Codex QA A27, round 8). The old fixture was repeated ASCII
  //    "a" at 3 bytes per character, which is not a notification: a multibyte character costs up to
  //    12 bytes once percent-encoded (U+1F338 is 4 UTF-8 bytes, %F0%9F%8C%B8). Every body here is
  //    built with URLSearchParams, the way a gateway posts it, and parsed back to prove it is.
  const encodedBytes = (fields: Array<[string, string]>) => new TextEncoder().encode(new URLSearchParams(fields).toString());
  const roundTrips = (body: Uint8Array, fields: Array<[string, string]>) => {
    const parsed = [...new URLSearchParams(new TextDecoder().decode(body)).entries()];
    assert.deepEqual(parsed, fields, 'the fixture is a genuine form-encoded body that parses back to its fields');
  };
  const BMP3 = '中'; // 3 UTF-8 bytes, 9 bytes percent-encoded, ONE UTF-16 unit
  const ASTRAL4 = '\u{1F338}'; // 4 UTF-8 bytes, 12 bytes percent-encoded, TWO UTF-16 units
  const short = (count: number): Array<[string, string]> => Array.from({ length: count }, (_, i) => [`f${i}`, 'x'.repeat(20)]);
  {
    // 6a. PayFast ITN as it reaches us. We send only m_payment_id and item_name, each validated to at
    //     most 100 UTF-16 units (lib/payments/gateway-field-limits.ts, compared with String.length), so
    //     the worst echo is 100 BMP 3-byte characters each (9 bytes per unit). The payer-held fields
    //     name_first, name_last and email_address (100 characters each documented) are taken as ALL
    //     4-byte characters (12 bytes each, past anything real). custom_str1-5 and custom_int1-5 are
    //     not sent by us and are echoed empty. 16 more short fields at about 25 bytes each.
    const payfast: Array<[string, string]> = [
      ['m_payment_id', BMP3.repeat(100)], ['pf_payment_id', '1089250'], ['payment_status', 'COMPLETE'],
      ['item_name', BMP3.repeat(100)], ['item_description', ''], ['amount_gross', '1250.00'], ['amount_fee', '-28.75'], ['amount_net', '1221.25'],
      ['custom_str1', ''], ['custom_str2', ''], ['custom_str3', ''], ['custom_str4', ''], ['custom_str5', ''],
      ['custom_int1', ''], ['custom_int2', ''], ['custom_int3', ''], ['custom_int4', ''], ['custom_int5', ''],
      ['name_first', ASTRAL4.repeat(100)], ['name_last', ASTRAL4.repeat(100)], ['email_address', ASTRAL4.repeat(100)],
      ['merchant_id', '10000100'], ['signature', 'a'.repeat(32)],
      ...short(16),
    ];
    const body = encodedBytes(payfast);
    roundTrips(body, payfast);
    assert.ok(body.byteLength > 5000, `fixture is genuinely large (${body.byteLength} bytes), not a few hundred`);
    assert.ok(body.byteLength * 2 <= CAP, `the cap is at least 2x the realistic PayFast worst case (${body.byteLength} of ${CAP})`);
    const result = await readCappedBody(streamRequest([body], { 'content-length': String(body.byteLength) }).request);
    assert.ok(result.ok && result.text.length === body.byteLength, 'the realistic PayFast worst case is accepted whole');
    const chunked = await readCappedBody(streamRequest([body.subarray(0, 1000), body.subarray(1000)]).request);
    assert.ok(chunked.ok && chunked.text === new TextDecoder().decode(body), 'and accepted whole when chunked');
  }
  {
    // 6b. Ozow notify: the 13 documented fields plus Hash, each at its documented maximum
    //     (lib/payments/gateway-field-limits.ts; TransactionId 36, Status 20, StatusMessage 250) as
    //     all-BMP 3-byte characters (9 bytes per unit); Hash is 128 hex characters.
    const ozowMax: Array<[string, number]> = [
      ['SiteCode', 50], ['TransactionId', 36], ['TransactionReference', 50], ['Amount', 10], ['Status', 20],
      ['Optional1', 50], ['Optional2', 50], ['Optional3', 50], ['Optional4', 50], ['Optional5', 50],
      ['CurrencyCode', 3], ['IsTest', 5], ['StatusMessage', 250],
    ];
    const ozow: Array<[string, string]> = [...ozowMax.map(([name, units]): [string, string] => [name, BMP3.repeat(units)]), ['Hash', 'f'.repeat(128)]];
    const body = encodedBytes(ozow);
    roundTrips(body, ozow);
    assert.ok(body.byteLength * 2 <= CAP, `the cap is at least 2x the Ozow worst case (${body.byteLength} of ${CAP})`);
    const result = await readCappedBody(streamRequest([body], { 'content-length': String(body.byteLength) }).request);
    assert.ok(result.ok && result.text.length === body.byteLength, 'the Ozow worst case is accepted whole');
  }
  {
    // 6c. Informational, NOT asserted: the extreme the documented PayFast field maxima allow if every
    //     free-text character were a 4-byte one (custom_str1-5 5x255, item_name 100, item_description
    //     255, m_payment_id 100, name_first/last 100, email 100 = 2030 characters at 12 bytes) plus 30
    //     short fields. We never send custom_str or item_description, so a purchase made here cannot
    //     produce this body; whether the cap should cover it is a product decision.
    const extreme: Array<[string, string]> = [
      ...['custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5'].map((n): [string, string] => [n, ASTRAL4.repeat(255)]),
      ['item_name', ASTRAL4.repeat(100)], ['item_description', ASTRAL4.repeat(255)], ['m_payment_id', ASTRAL4.repeat(100)],
      ['name_first', ASTRAL4.repeat(100)], ['name_last', ASTRAL4.repeat(100)], ['email_address', ASTRAL4.repeat(100)],
      ...short(30),
    ];
    console.log(`webhook-body golden: informational, extreme all-4-byte PayFast body = ${encodedBytes(extreme).byteLength} bytes against a cap of ${CAP}`);
  }

  // 7. A cancel() that rejects must not turn an over-cap body into a throw: all three over-cap paths
  //    still come back as a refusal (Codex QA A27, round 8).
  for (const [name, headers] of [
    ['declared over the cap', { 'content-length': String(CAP + 1) }],
    ['chunked over the cap', {}],
    ['lying Content-Length', { 'content-length': '10' }],
  ] as const) {
    const { request, probe } = streamRequest(Array.from({ length: 8 }, () => bytes(4096)), { ...headers }, true);
    const result = await readCappedBody(request);
    assert.equal(result.ok, false, `${name}: a rejecting cancel() still gives the over-cap result, not a throw`);
    assert.equal(probe.cancelled, true, `${name}: cancel was attempted`);
  }

  console.log('webhook-body golden: PASS');
}

main().catch((error) => {
  console.error('webhook-body golden: FAIL');
  console.error(error);
  process.exit(1);
});
