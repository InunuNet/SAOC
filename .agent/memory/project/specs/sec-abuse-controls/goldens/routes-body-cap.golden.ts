// Behavioural golden for the body cap of the three public POST routes that parse JSON after the
// limiter: contact, newsletter subscribe, newsletter unsubscribe. The Content-Length pre-check trusts
// the header; this golden proves the cap is ALSO enforced on the bytes actually read from the stream,
// so a request that under-declares (or lies about) its length cannot buffer an oversized body.
// Drives each REAL route handler against the in-memory Firestore fake. Per route:
//   1. under-declared length (header "2") + an endless stream      -> 413, cut off near the cap, cancelled
//   2. under-declared length + a valid 100,000-byte JSON value     -> 413 (the parsed-whole-body hole)
//   3. absent Content-Length                                       -> 413 (existing pre-check, unchanged)
//   4. exactly the cap, declared truthfully                        -> let through; one byte over, under-declared -> 413
//   5. a cancel() that rejects                                     -> still 413, never a 500
//   6. a stream that errors mid-read                               -> the route's existing invalid-body response
//   7. limiter order: an exhausted client, or a down store, pulls ZERO bytes of an oversize stream
// Frozen by @architect. @dev implements against this and never edits it.
// Run: pnpm exec tsx .agent/memory/project/specs/sec-abuse-controls/goldens/routes-body-cap.golden.ts
import assert from 'node:assert/strict';
import path from 'node:path';
import { FakeFirestore, installMocks, type SanityFixture } from './fakes';

const ROOT = process.env.SEC_GOLDEN_ROOT ?? path.resolve(__dirname, '../../../../../..');

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'mockproj';
process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';

const db = new FakeFirestore();
const sanity: SanityFixture = { salesOpen: true, shows: [], types: {}, queries: [] };
installMocks(db, sanity);
const outbound: string[] = [];
globalThis.fetch = (async (input: unknown) => { outbound.push(String(input)); throw new Error('no network in this golden'); }) as typeof fetch;

const lb = '35.191.0.1';
const CHUNK = 4096;
const SAFETY_CHUNKS = 400; // an endless stream stops itself after 400 chunks (1.6 MiB)
const TOO_LARGE_MESSAGE = 'Request body too large.';

interface RouteCase {
  name: string;
  file: string;
  url: string;
  cap: number; // MAX_BODY_BYTES in the route, unchanged by this fix
  max: number; // per-window limiter allowance, unchanged
}

const ROUTES: RouteCase[] = [
  { name: 'contact', file: 'app/api/contact/route.ts', url: 'http://localhost/api/contact', cap: 32768, max: 5 },
  { name: 'newsletter subscribe', file: 'app/api/newsletter/subscribe/route.ts', url: 'http://localhost/api/newsletter/subscribe', cap: 4096, max: 5 },
  { name: 'newsletter unsubscribe', file: 'app/api/newsletter/unsubscribe/route.ts', url: 'http://localhost/api/newsletter/unsubscribe', cap: 4096, max: 10 },
];

interface Pulled { bytes: number; cancelled: boolean }

async function main() {
  const { NextRequest } = await import('next/server');

  const build = (url: string, headers: Record<string, string>, body: ReadableStream<Uint8Array> | string) =>
    new NextRequest(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
      duplex: 'half',
    } as ConstructorParameters<typeof NextRequest>[1]);

  // A stream that hands out `chunks` and counts every byte pulled from it. highWaterMark 0 means a
  // chunk is only produced when a reader asks, so `pulled.bytes` is what the route actually read.
  const counted = (chunks: Uint8Array[] | 'endless', pulled: Pulled, options: { rejectCancel?: boolean; errorAfter?: number } = {}) => {
    let index = 0;
    const filler = new Uint8Array(CHUNK).fill(0x20);
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (options.errorAfter !== undefined && index >= options.errorAfter) { controller.error(new Error('socket reset')); return; }
        const next = chunks === 'endless' ? (index < SAFETY_CHUNKS ? filler : null) : (chunks[index] ?? null);
        if (next === null) { controller.close(); return; }
        index += 1;
        pulled.bytes += next.byteLength;
        controller.enqueue(next);
      },
      cancel() {
        pulled.cancelled = true;
        if (options.rejectCancel) return Promise.reject(new Error('cancel refused'));
      },
    }, { highWaterMark: 0 });
  };

  const split = (text: string): Uint8Array[] => {
    const bytes = new TextEncoder().encode(text);
    const out: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += CHUNK) out.push(bytes.subarray(i, i + CHUNK));
    return out;
  };

  for (const route of ROUTES) {
    const handler = (await import(path.join(ROOT, route.file))).POST as (request: InstanceType<typeof NextRequest>) => Promise<Response>;
    assert.equal(typeof handler, 'function', `${route.name}: exports POST`);
    const label = (text: string) => `${route.name}: ${text}`;
    let hopCounter = 0;
    const freshHop = () => `10.0.0.1, 198.51.100.${(hopCounter += 1)}, ${lb}`;
    const json = async (response: Response) => response.json().catch(() => null) as Promise<unknown>;

    db.clear();
    process.env.RECOVERY_TOKEN_SECRET = 'golden-recovery-secret';

    // 1. Under-declared length with an endless stream: refused on the bytes read, near the cap.
    {
      const pulled: Pulled = { bytes: 0, cancelled: false };
      const response = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': freshHop() }, counted('endless', pulled)));
      assert.equal(response.status, 413, label('an endless stream under a 2-byte Content-Length is refused 413'));
      assert.equal(((await json(response)) as { error?: string } | null)?.error, TOO_LARGE_MESSAGE, label('the 413 reuses the existing message'));
      assert.ok(pulled.bytes > 0, label('the stream was actually read: the cap is enforced on bytes read'));
      assert.ok(pulled.bytes <= route.cap + 3 * CHUNK, label(`the stream is cut off near the cap (pulled ${pulled.bytes} bytes)`));
      assert.equal(pulled.cancelled, true, label('the over-cap stream is cancelled'));
    }

    // 2. The reported hole: a valid 100,000-byte JSON value under "Content-Length: 2".
    {
      const payload = JSON.stringify({ email: 'a@example.org', message: 'x'.repeat(100000) });
      assert.ok(payload.length >= 100000, label('fixture is the 100,000-byte value from the review'));
      const pulled: Pulled = { bytes: 0, cancelled: false };
      const response = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': freshHop() }, counted(split(payload), pulled)));
      assert.equal(response.status, 413, label('a 100,000-byte JSON value under Content-Length: 2 is refused 413, not parsed'));
      assert.ok(pulled.bytes <= route.cap + 3 * CHUNK, label(`the 100,000-byte value is not read whole (pulled ${pulled.bytes} bytes)`));
      assert.equal(pulled.cancelled, true, label('the over-cap stream is cancelled'));
    }

    // 3. Absent Content-Length keeps its existing refusal: the pre-check is unchanged.
    {
      const response = await handler(build(route.url, { 'x-forwarded-for': freshHop() }, counted('endless', { bytes: 0, cancelled: false })));
      assert.equal(response.status, 413, label('an endless stream with no Content-Length is refused 413'));
    }

    // 4. The boundary is exact: `cap` bytes declared truthfully pass, one more under-declared does not.
    {
      const atCap = `{}${' '.repeat(route.cap - 2)}`;
      assert.equal(new TextEncoder().encode(atCap).byteLength, route.cap, label('fixture is exactly the cap'));
      const passed = await handler(build(route.url, { 'content-length': String(route.cap), 'x-forwarded-for': freshHop() }, counted(split(atCap), { bytes: 0, cancelled: false })));
      assert.notEqual(passed.status, 413, label('a body of exactly the cap is not refused as too large'));
      assert.ok(passed.status < 500, label(`a body of exactly the cap is not a server error (got ${passed.status})`));

      const overByOne = `{}${' '.repeat(route.cap - 1)}`;
      const refused = await handler(build(route.url, { 'content-length': String(route.cap), 'x-forwarded-for': freshHop() }, counted(split(overByOne), { bytes: 0, cancelled: false })));
      assert.equal(refused.status, 413, label('one byte over the cap, under-declared as the cap, is refused 413'));
    }

    // 5. A cancel() that rejects must not turn the 413 into a 500.
    {
      const pulled: Pulled = { bytes: 0, cancelled: false };
      const response = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': freshHop() }, counted('endless', pulled, { rejectCancel: true })));
      assert.equal(response.status, 413, label('a rejecting cancel() still gives 413'));
      assert.equal(pulled.cancelled, true, label('cancel was attempted'));
    }

    // 6. A stream that errors mid-read gets the route's existing invalid-body response: the same
    //    status and body as a malformed-JSON request on this route, not a 413 and not a 500.
    {
      const junk = '{not json';
      const reference = await handler(build(route.url, { 'content-length': String(junk.length), 'x-forwarded-for': freshHop() }, junk));
      const referenceBody = await json(reference);
      assert.ok(reference.status >= 400 && reference.status < 500 && reference.status !== 413, label(`malformed JSON is a 4xx invalid-body response (got ${reference.status})`));
      const pulled: Pulled = { bytes: 0, cancelled: false };
      const broken = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': freshHop() }, counted([new Uint8Array(8).fill(0x7b)], pulled, { errorAfter: 1 })));
      assert.equal(broken.status, reference.status, label('a read failure has the same status as malformed JSON'));
      assert.deepEqual(await json(broken), referenceBody, label('a read failure has the same body as malformed JSON'));
    }

    // 7. Limiter order is unchanged: the limiter decides before a single body byte is pulled.
    {
      const hop = freshHop();
      for (let i = 0; i < route.max; i++) {
        const ok = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': hop }, '{}'));
        assert.notEqual(ok.status, 429, label(`request ${i + 1} of ${route.max} is let through`));
      }
      const pulled: Pulled = { bytes: 0, cancelled: false };
      const refused = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': hop }, counted('endless', pulled)));
      assert.equal(refused.status, 429, label('the exhausted client is refused 429, not 413'));
      assert.match(refused.headers.get('retry-after') ?? '', /^[1-9]\d*$/, label('the refusal carries Retry-After'));
      assert.equal(pulled.bytes, 0, label('no body byte is pulled before the limiter refuses'));

      db.failing = true;
      const downPulled: Pulled = { bytes: 0, cancelled: false };
      const down = await handler(build(route.url, { 'content-length': '2', 'x-forwarded-for': freshHop() }, counted('endless', downPulled)));
      assert.equal(down.status, 500, label('a down limiter store refuses the request, not 413'));
      assert.equal(downPulled.bytes, 0, label('no body byte is pulled when the limiter store is down'));
      db.failing = false;
    }

    assert.equal(outbound.length, 0, label('no network use'));
  }

  console.log('routes-body-cap golden: PASS');
}

main().catch((error) => {
  console.error('routes-body-cap golden: FAIL');
  console.error(error);
  process.exit(1);
});
