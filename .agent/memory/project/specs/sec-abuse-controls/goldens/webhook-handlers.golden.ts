// Behavioural golden for the four payment-notification (ITN) routes and the two shared handlers
// (SEC-17): the body is read through the capped reader BEFORE verification, an over-cap body gets
// 413 without reaching verification, a body exactly at the cap still verifies, and no other body
// reader (text/json/formData/arrayBuffer/blob) is used on the request.
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/webhook-handlers.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');
const CAP = 16384;

async function main() {
  const { NextRequest } = await import('next/server');
  const tickets = await import(path.join(ROOT, 'lib/tickets-notification.ts'));
  const vendors = await import(path.join(ROOT, 'lib/vendor-stand-payment-notification.ts'));

  function build(chunks: Uint8Array[], headers: Record<string, string>) {
    const probe = { cancelled: false, pulledBytes: 0, readers: [] as string[] };
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (index >= chunks.length) { controller.close(); return; }
        const chunk = chunks[index++];
        probe.pulledBytes += chunk.byteLength;
        controller.enqueue(chunk);
      },
      cancel() { probe.cancelled = true; },
    });
    const request = new NextRequest('http://localhost/api/notify', {
      method: 'POST', headers, body,
      // @ts-expect-error duplex is required by undici for stream bodies
      duplex: 'half',
    });
    for (const reader of ['text', 'json', 'formData', 'arrayBuffer', 'blob'] as const) {
      const original = (request as unknown as Record<string, (...a: unknown[]) => unknown>)[reader].bind(request);
      (request as unknown as Record<string, unknown>)[reader] = (...a: unknown[]) => { probe.readers.push(reader); return original(...a); };
    }
    return { request, probe };
  }
  const bytes = (n: number) => new Uint8Array(n).fill(0x61);

  for (const [name, handler] of [['tickets', tickets.POST], ['vendor stand', vendors.POST]] as const) {
    const label = (text: string) => `${name}: ${text}`;
    const run = async (chunks: Uint8Array[], headers: Record<string, string>) => {
      let verifications = 0;
      const provider = {
        id: 'stub',
        verifyNotification: async () => { verifications += 1; return { verified: false, reason: 'bad-signature', reference: null }; },
      };
      const { request, probe } = build(chunks, headers);
      const response = await handler(provider, request);
      return { status: response.status, verifications, probe };
    };

    // A declared Content-Length over the cap: 413, never verified, stream cancelled.
    let r = await run([bytes(100)], { 'content-length': String(CAP + 1) });
    assert.equal(r.status, 413, label('declared oversize is 413'));
    assert.equal(r.verifications, 0, label('declared oversize never reaches verification'));
    assert.equal(r.probe.cancelled, true, label('declared oversize cancels the body stream'));
    assert.deepEqual(r.probe.readers, [], label('no other body reader is used'));

    // No Content-Length (chunked): cut off at the cap.
    r = await run(Array.from({ length: 8 }, () => bytes(4096)), {});
    assert.equal(r.status, 413, label('chunked oversize is 413'));
    assert.equal(r.verifications, 0);
    assert.equal(r.probe.cancelled, true);
    assert.ok(r.probe.pulledBytes <= CAP + 4096, label(`the reader stops at the cap, read ${r.probe.pulledBytes}`));

    // A lying (under-declared) Content-Length cannot smuggle a large body past the stream cap.
    r = await run(Array.from({ length: 8 }, () => bytes(4096)), { 'content-length': '10' });
    assert.equal(r.status, 413, label('a lying Content-Length is 413'));
    assert.equal(r.verifications, 0);

    // Exactly at the cap, declared and chunked: still verified, acknowledged (the stub rejects the signature).
    for (const headers of [{ 'content-length': String(CAP) }, {}]) {
      r = await run([bytes(CAP / 2), bytes(CAP / 2)], headers);
      assert.equal(r.status, 200, label('a body exactly at the cap is acknowledged, not refused'));
      assert.equal(r.verifications, 1, label('a body exactly at the cap reaches verification'));
      assert.deepEqual(r.probe.readers, [], label('only the capped reader consumed the body'));
    }

    // A normal small notification, and an empty one.
    r = await run([bytes(300)], { 'content-length': '300' });
    assert.equal(r.verifications, 1);
    r = await run([], {});
    assert.equal(r.verifications, 1, label('an empty body is verified (and rejected) as before'));
  }

  // The four routes themselves: an over-cap body is refused 413 before any verification or Firestore access.
  for (const file of [
    'app/api/tickets/itn/route.ts', 'app/api/tickets/ozow-itn/route.ts',
    'app/api/vendors/stand-payment/ozow-itn/route.ts', 'app/api/vendors/stand-payment/payfast-itn/route.ts',
  ]) {
    const { POST } = await import(path.join(ROOT, file));
    const { request } = build([bytes(100)], { 'content-length': String(CAP + 1), 'content-type': 'application/x-www-form-urlencoded' });
    const response = await POST(request);
    assert.equal(response.status, 413, `${file}: an over-cap notification is 413`);
  }

  console.log('webhook-handlers golden: PASS');
}

main().catch((error) => {
  console.error('webhook-handlers golden: FAIL');
  console.error(error);
  process.exit(1);
});
