// Golden for lib/webhook-body.ts (SEC-17): bounded body read for the exempt ITN routes.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/webhook-body.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');
const CAP = 16384;

function streamRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
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

  // 6. A maximal real notification fits with a wide margin (spec.md D6 derivation). PayFast ITN
  //    free-text capacity: custom_str1-5 (5 x 255), item_name 100, item_description 255,
  //    m_payment_id 100, name_first 100, name_last 100, email_address 100 = 2030 characters,
  //    every one percent-encoded at 3 bytes (worst case), plus 30 short fields at 40 bytes.
  {
    const freeTextChars = 5 * 255 + 100 + 255 + 100 + 100 + 100 + 100;
    const worstEncoded = freeTextChars * 3 + 30 * 40;
    assert.equal(freeTextChars, 2030);
    assert.ok(worstEncoded * 2 <= CAP, 'cap is at least 2x the worst-case encoded notification');
    const body = 'a'.repeat(worstEncoded);
    const result = await readCappedBody(streamRequest([new TextEncoder().encode(body)], { 'content-length': String(body.length) }).request);
    assert.ok(result.ok, 'a worst-case-sized notification body is accepted');
  }

  console.log('webhook-body golden: PASS');
}

main().catch((error) => {
  console.error('webhook-body golden: FAIL');
  console.error(error);
  process.exit(1);
});
