// Golden for lib/orders.ts getConfirmedOrderByOrderId (mission nos-order-recovery, Codex F1+F2 on #165).
// Frozen by @architect. Run: pnpm exec tsx .agent/memory/project/specs/nos-order-recovery/goldens/confirmed-order-binding.golden.ts
// The recovery token authorises ONE order document. What the page renders must come from that same
// document. Firestore has no uniqueness constraint on m_payment_id, so two orders can share a reference;
// a lookup by reference would then render the wrong order's tickets. This golden builds exactly that
// collision with an in-memory db and requires the display to follow the order id, never the reference.
import assert from 'node:assert/strict';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../../../..');

type Doc = { id: string; data: Record<string, unknown> };

function makeDb(orders: Doc[], tickets: Doc[]) {
  const queries: string[] = [];
  const snap = (d: Doc | undefined, id: string) => ({ id, exists: d !== undefined, data: () => d?.data });
  const db = {
    collection(name: string) {
      if (name === 'orders') {
        return {
          doc: (id?: string) => ({
            id: id ?? '',
            get: async () => {
              queries.push(`orders.doc(${id})`);
              return snap(orders.find((o) => o.id === id), id ?? '');
            },
          }),
          where: (field: string, _op: string, value: unknown) => {
            queries.push(`orders.where(${field}=${String(value)})`);
            const hits = orders.filter((o) => o.data[field] === value);
            const q = {
              limit: () => q,
              get: async () => ({ empty: hits.length === 0, docs: hits.map((o) => ({ id: o.id, exists: true, data: () => o.data })) }),
            };
            return q;
          },
        };
      }
      return {
        doc: (id?: string) => ({ id: id ?? '' }),
        where: (field: string, _op: string, value: unknown) => {
          queries.push(`tickets.where(${field}=${String(value)})`);
          const hits = tickets.filter((t) => t.data[field] === value);
          const q = { limit: () => q, get: async () => ({ empty: hits.length === 0, docs: hits.map((t) => ({ id: t.id, exists: true, data: () => t.data })) }) };
          return q;
        },
      };
    },
    runTransaction: async () => {
      throw new Error('golden: no transactions expected');
    },
  };
  return { db, queries };
}

const position = (id: string, orderId: string, name: string, extra: Record<string, unknown> = {}): Doc => ({
  id,
  data: { orderId, status: 'paid', attendeeName: name, ticketType: 'Day Visitor', amount: 100, bookingRef: `BK-${id}`, chosenDay: null, ...extra },
});

async function main() {
  const orders = await import(path.join(ROOT, 'lib/orders.ts'));
  const { getConfirmedOrderByOrderId } = orders;
  assert.equal(typeof getConfirmedOrderByOrderId, 'function', 'lib/orders.ts exports getConfirmedOrderByOrderId');
  const generateQrDataUri = async (bookingRef: string) => `qr:${bookingRef}`;

  const orderA: Doc = { id: 'order-A', data: { m_payment_id: 'REF-X', status: 'paid' } };
  const orderB: Doc = { id: 'order-B', data: { m_payment_id: 'REF-X', status: 'paid' } }; // same reference as A
  const posA = position('a1', 'order-A', 'Alice');
  const posB = position('b1', 'order-B', 'Bob');

  // 1. Collision: A's id renders A's tickets only, whichever order Firestore would return first for REF-X.
  for (const orderList of [[orderA, orderB], [orderB, orderA]]) {
    const { db, queries } = makeDb(orderList, [posB, posA]);
    const shown = await getConfirmedOrderByOrderId('order-A', { db, generateQrDataUri });
    assert.deepStrictEqual(shown, {
      reference: 'REF-X',
      positions: [{ bookingRef: 'BK-a1', attendeeName: 'Alice', ticketType: 'Day Visitor', amount: 100, qrDataUri: 'qr:BK-a1', chosenDay: null }],
    });
    assert.ok(!queries.some((q) => q.startsWith('orders.where')), 'the order is read by id, never by a query on the reference');
    assert.ok(!queries.includes('tickets.where(orderId=order-B)'), "B's positions are never read for A's token");
  }

  // 2. A has no confirmed positions while B does: null, never B's tickets.
  {
    const { db } = makeDb([orderA, orderB], [posB, position('a2', 'order-A', 'Alice', { status: 'reserved' })]);
    assert.equal(await getConfirmedOrderByOrderId('order-A', { db, generateQrDataUri }), null);
  }

  // 3. A is not paid (B is): null.
  for (const status of ['reserved', 'cancelled', 'expired', 'PAID', '']) {
    const { db } = makeDb([{ id: 'order-A', data: { m_payment_id: 'REF-X', status } }, orderB], [posA, posB]);
    assert.equal(await getConfirmedOrderByOrderId('order-A', { db, generateQrDataUri }), null, `status ${JSON.stringify(status)}`);
  }

  // 4. Unknown or empty id: null, and an empty id does not read the orders collection at all.
  {
    const { db } = makeDb([orderA, orderB], [posA, posB]);
    assert.equal(await getConfirmedOrderByOrderId('order-Z', { db, generateQrDataUri }), null);
    const empty = makeDb([orderA], [posA]);
    assert.equal(await getConfirmedOrderByOrderId('', { db: empty.db, generateQrDataUri }), null);
    assert.deepStrictEqual(empty.queries, []);
  }

  // 5. Only confirmed positions of the verified order, with the same filters as the confirmation page:
  //    checked-in counts, incomplete rows are skipped, QR is generated per kept position only.
  {
    const kept = position('a3', 'order-A', 'Cara', { status: 'checked-in', chosenDay: '2027-03-06' });
    const noName = position('a4', 'order-A', '', {});
    const noAmount = { id: 'a5', data: { ...position('a5', 'order-A', 'Dan').data, amount: '100' } };
    const { db } = makeDb([orderA], [posA, kept, noName, noAmount]);
    const qrCalls: string[] = [];
    const shown = await getConfirmedOrderByOrderId('order-A', { db, generateQrDataUri: async (b: string) => (qrCalls.push(b), `qr:${b}`) });
    assert.deepStrictEqual(shown.positions.map((p: { bookingRef: string }) => p.bookingRef), ['BK-a1', 'BK-a3']);
    assert.equal(shown.positions[1].chosenDay, '2027-03-06');
    assert.deepStrictEqual(qrCalls, ['BK-a1', 'BK-a3']);
  }

  process.stdout.write('confirmed-order-binding.golden: PASS\n');
}

main().catch((error) => {
  process.stderr.write(`confirmed-order-binding.golden: FAIL ${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
