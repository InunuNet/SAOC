/**
 * societies-content F1 — pure planner for the Drive -> Sanity society sync.
 *
 * Given the 21 merged society docs, the society docs already in the store and the ids to hide,
 * decide CREATE / PATCH / HIDE / NOOP per doc. Nothing here talks to a store; `DocStore` is the
 * seam the CLI implements for Sanity and for the fixture file.
 */

import type { SocietyDocFields } from './drive-parse';

export interface ExistingDoc extends Record<string, unknown> {
  _id: string;
  _type: string;
  _rev: string;
  name?: string;
}

export interface HideTarget {
  _id: string;
  name: string;
  reason: string;
}

/** Fields the sync never compares or writes on a matched doc: identity stays as it is. */
const IDENTITY_FIELDS = new Set(['name', 'slug']);
/** Our own estimates, cleared on every doc that now carries Lee-Ann's data. */
const INVENTED_FIELDS = ['founded', 'memberCount'] as const;

export type PlanItem =
  | { kind: 'create'; id: string; doc: Record<string, unknown> }
  | { kind: 'patch'; id: string; rev: string; set: Record<string, unknown>; unset: string[] }
  | { kind: 'hide'; id: string; rev: string }
  | { kind: 'noop'; id: string };

export interface SyncPlan {
  items: PlanItem[];
  unlisted: string[];
  counts: { create: number; patch: number; hide: number; noop: number };
}

export class UnexpectedStateError extends Error {}

export interface WriteOp {
  kind: 'create' | 'patch';
  id: string;
  rev?: string;
  doc?: Record<string, unknown>;
  set?: Record<string, unknown>;
  unset?: string[];
}

export interface DocStore {
  readonly kind: 'fixture' | 'sanity';
  /** Published `society` documents with their `_rev`. */
  listPublished(): Promise<ExistingDoc[]>;
  /** Every `society` document, published and drafts, for the backup. */
  listAllForBackup(): Promise<ExistingDoc[]>;
  /**
   * Every write in ONE transaction: all land or none do. A patch is locked to its `rev` and a
   * stale revision fails the transaction; a create of an existing id fails it too.
   */
  commitAll(ops: readonly WriteOp[]): Promise<void>;
  /** Flush a fixture store to its output file. */
  finish(): Promise<void>;
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Order-independent form for comparison: Sanity returns object keys in its own order (sorted),
 * and an absent key equals a null one. Arrays keep their order.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => !isEmpty(v))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

export function sameValue(a: unknown, b: unknown): boolean {
  if (isEmpty(a) && isEmpty(b)) return true;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function planMatched(existing: ExistingDoc, doc: SocietyDocFields): PlanItem {
  const set: Record<string, unknown> = {};
  const unset = new Set<string>();
  for (const [key, value] of Object.entries(doc)) {
    if (IDENTITY_FIELDS.has(key) || sameValue(existing[key], value)) continue;
    if (value === null) unset.add(key);
    else set[key] = value;
  }
  for (const key of INVENTED_FIELDS) if (!isEmpty(existing[key])) unset.add(key);
  if (Object.keys(set).length === 0 && unset.size === 0) return { kind: 'noop', id: existing._id };
  return { kind: 'patch', id: existing._id, rev: existing._rev, set, unset: [...unset].sort() };
}

function slugId(doc: SocietyDocFields): string {
  return `society-${doc.slug.current}`;
}

export function planSync(
  docs: readonly SocietyDocFields[],
  existing: readonly ExistingDoc[],
  hide: readonly HideTarget[],
): SyncPlan {
  const byName = new Map(existing.filter((d) => d.name !== undefined).map((d) => [d.name, d]));
  const byId = new Map(existing.map((d) => [d._id, d]));
  const items: PlanItem[] = [];
  const claimed = new Set<string>();

  for (const doc of docs) {
    const match = byName.get(doc.name);
    if (match) {
      claimed.add(match._id);
      items.push(planMatched(match, doc));
      continue;
    }
    const id = slugId(doc);
    const clash = byId.get(id);
    if (clash) {
      throw new UnexpectedStateError(
        `document ${id} exists as "${String(clash.name)}", not "${doc.name}"; refusing to overwrite`,
      );
    }
    claimed.add(id);
    items.push({ kind: 'create', id, doc: { _id: id, _type: 'society', ...doc } });
  }

  for (const target of hide) {
    const found = byId.get(target._id);
    if (!found) throw new UnexpectedStateError(`document to hide is missing: ${target._id}`);
    claimed.add(target._id);
    items.push(
      found.listed === false
        ? { kind: 'noop', id: found._id }
        : { kind: 'hide', id: found._id, rev: found._rev },
    );
  }

  const unlisted = existing.filter((d) => !claimed.has(d._id)).map((d) => d._id);
  const counts = { create: 0, patch: 0, hide: 0, noop: 0 };
  for (const item of items) counts[item.kind] += 1;
  return { items, unlisted, counts };
}

export function planToWriteOp(item: PlanItem): WriteOp | null {
  switch (item.kind) {
    case 'create':
      return { kind: 'create', id: item.id, doc: item.doc };
    case 'patch':
      return { kind: 'patch', id: item.id, rev: item.rev, set: item.set, unset: item.unset };
    case 'hide':
      return { kind: 'patch', id: item.id, rev: item.rev, set: { listed: false }, unset: [] };
    case 'noop':
      return null;
  }
}
