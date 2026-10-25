// A1 -- isTicketOnSale() truth table (goldens/predicate-truth-table.json). Pure: no env, no I/O.
// Red on the baseline tree because lib/ticket-on-sale.ts does not exist.
import { finish, golden } from './_golden.mts';

const mod = await import('../../../lib/ticket-on-sale.ts').catch((e: unknown) => {
  finish('A1 predicate truth table', [`lib/ticket-on-sale.ts cannot be imported: ${String(e).slice(0, 160)}`]);
});
const { isTicketOnSale } = mod as { isTicketOnSale: (i: unknown) => { onSale: boolean; reason: string | null } };

const table = golden('predicate-truth-table.json');
const failures: string[] = [];
if (typeof isTicketOnSale !== 'function') failures.push('isTicketOnSale is not exported');
else {
  for (const c of table.cases) {
    const doc = { ...table.baseDoc, ...c.doc };
    for (const k of c.delete) delete doc[k];
    const input = { ...table.baseInput, ...c.input, now: new Date(c.input.now ?? table.baseInput.now), doc };
    const got = isTicketOnSale(input);
    if (got.onSale !== c.expect.onSale || got.reason !== c.expect.reason) {
      failures.push(`${c.name}: expected ${JSON.stringify(c.expect)}, got ${JSON.stringify(got)}`);
    }
  }
}
finish(`A1 predicate truth table (${table.cases.length} cases)`, failures);
