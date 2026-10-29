// Shared in-memory fakes for the route-level goldens of sec-abuse-controls. Nothing here talks to
// Firestore, Sanity, a payment gateway or the network.
// Frozen by @architect. @dev implements against the goldens and never edits this.
//
// FakeFirestore models just enough of the Admin SDK for the checkout route, the limiter and the
// ledger: collections of plain documents, equality/range `where` chains, transactions with
// optimistic concurrency (a commit whose read set changed is aborted and the callback re-run, as
// Firestore does), and the one rule that matters for the Firestore-undefined-write convention:
// a write containing an `undefined` value throws, as the real SDK does.
import Module from 'node:module';

type Doc = Record<string, unknown>;

function isPlain(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Deep copy that keeps class instances (Timestamp, Date, FieldValue) intact. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (isPlain(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = clone(entry);
    return out as T;
  }
  return value;
}

function assertNoUndefined(value: unknown, where: string): void {
  if (value === undefined) throw new Error(`Cannot use "undefined" as a Firestore value (${where})`);
  if (Array.isArray(value)) value.forEach((entry, i) => assertNoUndefined(entry, `${where}[${i}]`));
  else if (isPlain(value)) for (const [key, entry] of Object.entries(value)) assertNoUndefined(entry, `${where}.${key}`);
}

function comparable(value: unknown): unknown {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis(): number }).toMillis();
  }
  return value;
}

type Filter = { field: string; op: string; value: unknown };

function matches(data: Doc, filters: Filter[]): boolean {
  return filters.every(({ field, op, value }) => {
    const actual = comparable(data[field]);
    const wanted = comparable(value);
    switch (op) {
      case '==': return actual === wanted;
      case '!=': return actual !== wanted;
      case 'in': return Array.isArray(value) && value.map(comparable).includes(actual);
      case '>': return (actual as number) > (wanted as number);
      case '>=': return (actual as number) >= (wanted as number);
      case '<': return (actual as number) < (wanted as number);
      case '<=': return (actual as number) <= (wanted as number);
      default: throw new Error(`FakeFirestore: unsupported operator ${op}`);
    }
  });
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export class FakeSnapshot {
  constructor(readonly id: string, private readonly value: Doc | undefined, readonly ref: FakeDocRef) {}
  get exists(): boolean { return this.value !== undefined; }
  data(): Doc | undefined { return this.value === undefined ? undefined : clone(this.value); }
}

export class FakeQuerySnapshot {
  constructor(readonly docs: FakeSnapshot[]) {}
  get empty(): boolean { return this.docs.length === 0; }
  get size(): number { return this.docs.length; }
}

export class FakeDocRef {
  constructor(private readonly db: FakeFirestore, readonly collectionName: string, readonly id: string) {}
  get path(): string { return `${this.collectionName}/${this.id}`; }
  async get(): Promise<FakeSnapshot> { return this.db.snapshot(this); }
  async set(data: Doc): Promise<void> { this.db.applyWrite('set', this, data); }
  async create(data: Doc): Promise<void> { this.db.applyWrite('create', this, data); }
  async update(data: Doc): Promise<void> { this.db.applyWrite('update', this, data); }
  async delete(): Promise<void> { this.db.applyWrite('delete', this); }
}

export class FakeQuery {
  constructor(readonly db: FakeFirestore, readonly collectionName: string, readonly filters: Filter[] = [], readonly max?: number) {}
  where(field: string, op: string, value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.collectionName, [...this.filters, { field, op, value }], this.max);
  }
  limit(n: number): FakeQuery { return new FakeQuery(this.db, this.collectionName, this.filters, n); }
  async get(): Promise<FakeQuerySnapshot> { this.db.plainQueries.push(this.filters); return this.db.runQuery(this); }
}

export class FakeCollection extends FakeQuery {
  doc(id?: string): FakeDocRef { return new FakeDocRef(this.db, this.collectionName, id ?? this.db.autoId()); }
  async add(data: Doc): Promise<FakeDocRef> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

export interface FakeWrite { op: string; path: string }

export class FakeFirestore {
  readonly collections = new Map<string, Map<string, Doc>>();
  private readonly versions = new Map<string, number>();
  readonly writes: FakeWrite[] = [];
  /** Filters of every query run with a plain `.get()`, i.e. OUTSIDE any transaction. */
  readonly plainQueries: Filter[][] = [];
  failing = false;
  private nextId = 1;

  clear(): void {
    this.collections.clear();
    this.versions.clear();
    this.writes.length = 0;
    this.plainQueries.length = 0;
    this.failing = false;
  }
  autoId(): string { return `auto${this.nextId++}`; }
  collection(name: string): FakeCollection { return new FakeCollection(this, name); }
  seed(collectionName: string, id: string, data: Doc): void {
    assertNoUndefined(data, `${collectionName}/${id}`);
    this.bucket(collectionName).set(id, clone(data));
  }
  all(collectionName: string): Array<{ id: string; data: Doc }> {
    return [...this.bucket(collectionName)].map(([id, data]) => ({ id, data: clone(data) }));
  }
  private bucket(name: string): Map<string, Doc> {
    let bucket = this.collections.get(name);
    if (!bucket) this.collections.set(name, (bucket = new Map()));
    return bucket;
  }
  private colVersion(name: string): number { return this.versions.get(name) ?? 0; }
  private docVersion(path: string): number { return this.versions.get(path) ?? 0; }
  private bump(collectionName: string, path: string): void {
    this.versions.set(collectionName, this.colVersion(collectionName) + 1);
    this.versions.set(path, this.docVersion(path) + 1);
  }

  snapshot(ref: FakeDocRef): FakeSnapshot {
    if (this.failing) throw new Error('firestore unavailable');
    return new FakeSnapshot(ref.id, this.bucket(ref.collectionName).get(ref.id), ref);
  }
  runQuery(query: FakeQuery): FakeQuerySnapshot {
    if (this.failing) throw new Error('firestore unavailable');
    let rows = [...this.bucket(query.collectionName)].filter(([, data]) => matches(data, query.filters));
    if (query.max !== undefined) rows = rows.slice(0, query.max);
    return new FakeQuerySnapshot(rows.map(([id, data]) => new FakeSnapshot(id, data, new FakeDocRef(this, query.collectionName, id))));
  }

  applyWrite(op: 'set' | 'create' | 'update' | 'delete', ref: FakeDocRef, data?: Doc): void {
    if (this.failing) throw new Error('firestore unavailable');
    const bucket = this.bucket(ref.collectionName);
    if (op !== 'delete') assertNoUndefined(data, ref.path);
    if (op === 'create' && bucket.has(ref.id)) throw new Error(`ALREADY_EXISTS: ${ref.path}`);
    if (op === 'update' && !bucket.has(ref.id)) throw new Error(`NOT_FOUND: ${ref.path}`);
    if (op === 'delete') bucket.delete(ref.id);
    else bucket.set(ref.id, op === 'update' ? { ...bucket.get(ref.id), ...clone(data as Doc) } : clone(data as Doc));
    this.writes.push({ op, path: ref.path });
    this.bump(ref.collectionName, ref.path);
  }

  async runTransaction<T>(fn: (tx: FakeTransaction) => Promise<T>): Promise<T> {
    if (this.failing) throw new Error('firestore unavailable');
    for (let attempt = 0; attempt < 50; attempt++) {
      const tx = new FakeTransaction(this);
      const result = await fn(tx);
      if (tx.stale()) continue; // aborted: a read changed before commit, re-run the callback
      tx.commit();
      return result;
    }
    throw new Error('transaction aborted: too much contention');
  }

  /** @internal used by FakeTransaction */
  versionOf(key: string): number { return this.versions.get(key) ?? 0; }
}

export class FakeTransaction {
  private readonly reads = new Map<string, number>();
  private readonly pending: Array<() => void> = [];
  constructor(private readonly db: FakeFirestore) {}

  async get(target: FakeDocRef | FakeQuery): Promise<FakeSnapshot | FakeQuerySnapshot> {
    await tick();
    const key = target instanceof FakeDocRef ? target.path : target.collectionName;
    if (!this.reads.has(key)) this.reads.set(key, this.db.versionOf(key));
    const result = target instanceof FakeDocRef ? this.db.snapshot(target) : this.db.runQuery(target);
    await tick(); // every racer holds its snapshot before any commits
    return result;
  }
  set(ref: FakeDocRef, data: Doc): this { assertNoUndefined(data, ref.path); this.pending.push(() => this.db.applyWrite('set', ref, data)); return this; }
  create(ref: FakeDocRef, data: Doc): this { assertNoUndefined(data, ref.path); this.pending.push(() => this.db.applyWrite('create', ref, data)); return this; }
  update(ref: FakeDocRef, data: Doc): this { assertNoUndefined(data, ref.path); this.pending.push(() => this.db.applyWrite('update', ref, data)); return this; }
  delete(ref: FakeDocRef): this { this.pending.push(() => this.db.applyWrite('delete', ref)); return this; }
  stale(): boolean { return [...this.reads].some(([key, version]) => this.db.versionOf(key) !== version); }
  commit(): void { for (const write of this.pending) write(); }
}

// ---- Module boundary mocks (tsx runs the repo as CJS, so a require hook sees every import) ----

export interface SanityFixture {
  salesOpen: boolean;
  shows: unknown[];
  types: Record<string, unknown>;
  queries: string[];
}

export function installMocks(db: FakeFirestore, sanity: SanityFixture): void {
  const fakeSanity = {
    createClient: () => ({
      config: () => ({ useCdn: true }),
      fetch: async (query: string, params?: { slug?: string }) => {
        sanity.queries.push(query);
        if (/salesOpen/.test(query)) return { salesOpen: sanity.salesOpen };
        if (/_type == "show"\]/.test(query)) return sanity.shows;
        if (/_type == "ticketType"/.test(query) && params?.slug) return sanity.types[params.slug] ?? null;
        return [];
      },
    }),
  };
  // firebase-admin is patched in place on its exports object, so BOTH the static require() chain
  // and a native dynamic import() (the limiter's lazy import) see the fake, whichever loads first.
  const requireFromRoot = Module.createRequire(`${process.cwd()}/`);
  const patch = (specifier: string, name: string, value: unknown) => {
    const exportsObject = requireFromRoot(specifier) as Record<string, unknown>;
    Object.defineProperty(exportsObject, name, { value, configurable: true, writable: true, enumerable: true });
  };
  patch('firebase-admin/firestore', 'getFirestore', () => db);
  patch('firebase-admin/app', 'getApps', () => [{}]);

  const load = (Module as unknown as { _load: (req: string, parent: unknown, isMain: boolean) => unknown })._load;
  (Module as unknown as { _load: unknown })._load = function (req: string, parent: unknown, isMain: boolean) {
    if (req === 'next-sanity') return { ...(load(req, parent, isMain) as object), ...fakeSanity };
    return load(req, parent, isMain);
  };
}

export const FLAT_TICKET_TYPE = {
  _id: 't-vip', name: 'VIP', slug: 'vip', demo: false, active: true, price: 100, regularPrice: 100, capacity: 5000,
  show: { _ref: 'show1' }, releasedQuantity: null, earlyBirdCutoff: null, requiresDaySelection: false,
  requiresAttendeeNames: false, capacityPool: null, headcountPerUnit: null, excludedDays: [],
};

export const ACTIVE_SHOW = { _id: 'show1', active: true, startDate: '2099-03-11', endDate: '2099-03-14' };
