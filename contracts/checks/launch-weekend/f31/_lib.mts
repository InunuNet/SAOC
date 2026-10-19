// F31 shared offline harness: a minimal in-memory Firestore double (collection/doc/where/get/
// runTransaction), a signed Ozow notification builder, and an Ozow status-API fetch stub.
// No network, no real Firestore, no credentials. Run from the repo root with tsx.
import { Timestamp } from 'firebase-admin/firestore';
import { OZOW_NOTIFY_FIELD_ORDER, generateOzowHash } from '../../../../lib/ozow.ts';

export const SITE_CODE = 'F31-SITE';
export const PRIVATE_KEY = 'f31-private-key';
export const API_KEY = 'f31-api-key';
export const OZOW_ENV = {
  OZOW_SANDBOX_SITE_CODE: SITE_CODE,
  OZOW_SANDBOX_PRIVATE_KEY: PRIVATE_KEY,
  OZOW_SANDBOX_API_KEY: API_KEY,
};

type Doc = Record<string, unknown>;

export class FakeDb {
  readonly store = new Map<string, Map<string, Doc>>();
  seed(collection: string, id: string, data: Doc): void {
    if (!this.store.has(collection)) this.store.set(collection, new Map());
    this.store.get(collection)!.set(id, { ...data });
  }
  read(collection: string, id: string): Doc | undefined {
    const d = this.store.get(collection)?.get(id);
    return d ? { ...d } : undefined;
  }
  private snap(collection: string, id: string) {
    const d = this.store.get(collection)?.get(id);
    return { id, exists: d !== undefined, data: () => (d ? { ...d } : undefined) };
  }
  private ref(collection: string, id: string) {
    return { id, path: `${collection}/${id}`, _c: collection, get: async () => this.snap(collection, id) };
  }
  collection(name: string) {
    const docs = () => [...(this.store.get(name)?.keys() ?? [])];
    const query = (field: string, value: unknown) => {
      const run = async () => {
        const hits = docs().filter((id) => this.store.get(name)!.get(id)![field] === value).map((id) => this.snap(name, id));
        return { empty: hits.length === 0, docs: hits };
      };
      return { get: run, limit: () => ({ get: run }) };
    };
    return {
      doc: (id: string) => this.ref(name, id),
      where: (field: string, _op: '==', value: unknown) => query(field, value),
    };
  }
  async runTransaction<T>(fn: (tx: unknown) => Promise<T> | T): Promise<T> {
    const tx = {
      get: async (ref: { _c: string; id: string }) => this.snap(ref._c, ref.id),
      update: (ref: { _c: string; id: string }, data: Doc) => {
        const cur = this.store.get(ref._c)?.get(ref.id);
        if (!cur) throw new Error(`update on missing doc ${ref._c}/${ref.id}`);
        this.store.get(ref._c)!.set(ref.id, { ...cur, ...data });
      },
      set: (ref: { _c: string; id: string }, data: Doc) => {
        if (!this.store.has(ref._c)) this.store.set(ref._c, new Map());
        this.store.get(ref._c)!.set(ref.id, { ...data });
      },
    };
    return fn(tx);
  }
}

/** Builds a form-encoded Ozow notification body signed with the documented inbound field order. */
export function signedOzowBody(input: { reference: string; status: string; amount?: string; transactionId?: string; badHash?: boolean }): string {
  const fields: Record<string, string> = {
    SiteCode: SITE_CODE,
    TransactionId: input.transactionId ?? 'f31-txn-1',
    TransactionReference: input.reference,
    Amount: input.amount ?? '1500.00',
    Status: input.status,
    Optional1: '', Optional2: '', Optional3: '', Optional4: '', Optional5: '',
    CurrencyCode: 'ZAR',
    IsTest: 'true',
    StatusMessage: '',
  };
  const hash = input.badHash ? 'deadbeef' : generateOzowHash(fields, OZOW_NOTIFY_FIELD_ORDER, PRIVATE_KEY);
  return new URLSearchParams({ ...fields, Hash: hash }).toString();
}

/** Stubs GetTransactionByReference: answers with one row carrying `statusFor(reference)`. Counts calls. */
export function statusApiFetch(statusFor: (reference: string) => string) {
  const calls: string[] = [];
  const fetchStub = (async (url: string) => {
    const reference = new URL(url).searchParams.get('transactionReference') ?? '';
    calls.push(reference);
    return new Response(JSON.stringify([{ TransactionReference: reference, TransactionId: 'f31-txn-1', Status: statusFor(reference) }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
  return { fetchStub, calls };
}

export function minutesFromNow(minutes: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + minutes * 60_000);
}

export function hasUndefinedOwnProp(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== 'object' || value instanceof Timestamp) return false;
  return Object.values(value as Record<string, unknown>).some(hasUndefinedOwnProp);
}

export function makeChecker(label: string) {
  const problems: string[] = [];
  return {
    eq(name: string, got: unknown, want: unknown) {
      if (got !== want) problems.push(`${name}: got ${String(got)}, want ${String(want)}`);
    },
    ok(name: string, cond: boolean) {
      if (!cond) problems.push(`${name}: expected true`);
    },
    finish() {
      if (problems.length > 0) {
        console.error(`FAIL ${label}\n - ${problems.join('\n - ')}`);
        process.exit(1);
      }
      console.log(`PASS ${label}`);
    },
  };
}
