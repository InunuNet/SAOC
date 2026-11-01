/**
 * Pure selector for the go-live test-data purge (mission go-live-prep, F1).
 *
 * No IO, no Firestore, no writes: a snapshot goes in, a Selection comes out. Because this
 * module has no write API at all, a dry-run cannot mutate data by construction.
 *
 * Timestamps in a snapshot are ISO strings (the CLI converts live Firestore Timestamps before
 * calling in). `_updateTime` is the document revision marker used for drift detection.
 */

import { hash } from 'node:crypto';

export type PurgeCollection = 'orders' | 'tickets' | 'vendorStandOrders';
export type PurgeDoc = Record<string, unknown>;

export interface Snapshot {
  now: string;
  projectId: string;
  collections: Record<PurgeCollection, Record<string, PurgeDoc>>;
}

export interface DocRef {
  collection: PurgeCollection;
  id: string;
}

export interface SelectedDoc extends DocRef {
  updateTime: string | null;
}

export type ClassId =
  | 'reservedExpired'
  | 'sandboxPaidOrders'
  | 'orderPositions'
  | 'orphanPositions'
  | 'sandboxVendorStandOrders';

export interface SelectedClass {
  rule: string;
  action: 'delete';
  count: number;
  docs: SelectedDoc[];
}

export interface StockRow {
  showId: string;
  ticketType: string;
  before: number;
  after: number;
}

export interface Selection {
  classes: Record<ClassId, SelectedClass>;
  heldBack: Record<string, DocRef[]>;
  stockDelta: { note: string; rows: StockRow[] };
  totals: {
    selected: number;
    heldBack: number;
    byCollection: Record<string, number>;
  };
}

export interface GuardResult {
  ok: boolean;
  reason: string;
}

export interface GuardOptions {
  /** The parent order of a cascaded ticket carries test evidence. */
  parentIsTest?: boolean;
}

export const SANDBOX_AMOUNT = 0.01;
export const PURGEABLE_COLLECTIONS: readonly PurgeCollection[] = [
  'orders',
  'tickets',
  'vendorStandOrders',
];
const PROTECTED_STATUSES = ['paid', 'checked-in', 'checked_in', 'refunded'];
const SETTLED_TICKET_STATUSES = ['paid', 'checked-in', 'checked_in', 'refunded'];
const STOCK_NOTE =
  'Report only. No stored counter exists: availability is derived from tickets ' +
  '(status reserved|paid, expired reservations excluded, mirrors lib/data/tickets.ts ' +
  'stillHoldsSeat). Rows with before==after are omitted.';

/** An explicit `issuedInTestMode: false` always wins over the sandbox amount. */
export function isTestEvidence(doc: PurgeDoc): boolean {
  if (doc.issuedInTestMode === false) return false;
  return doc.issuedInTestMode === true || doc.expectedGatewayAmount === SANDBOX_AMOUNT;
}

/** Flagged real yet carrying the sandbox amount: contradictory, so held, never deleted. */
function isContradictory(doc: PurgeDoc): boolean {
  return doc.issuedInTestMode === false && doc.expectedGatewayAmount === SANDBOX_AMOUNT;
}

function isHeldPaid(doc: PurgeDoc): boolean {
  return !isTestEvidence(doc) && (isContradictory(doc) || !isExplicitlyReal(doc));
}

/** Positive record that the sale was real (flag false, or a gateway amount that is not the sandbox one). */
function isExplicitlyReal(doc: PurgeDoc): boolean {
  if (doc.issuedInTestMode === false) return true;
  return Object.hasOwn(doc, 'expectedGatewayAmount') && doc.expectedGatewayAmount !== SANDBOX_AMOUNT;
}

function isNil(value: unknown): boolean {
  return value === null || value === undefined;
}

function timeOf(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function isExpired(doc: PurgeDoc, nowMs: number): boolean {
  const at = timeOf(doc.expiresAt);
  return at !== null && at < nowMs;
}

function updateTimeOf(doc: PurgeDoc): string | null {
  return typeof doc._updateTime === 'string' ? doc._updateTime : null;
}

function byRef(a: DocRef, b: DocRef): number {
  return (a.collection + '/' + a.id).localeCompare(b.collection + '/' + b.id);
}

function toSelected(collection: PurgeCollection, docs: Record<string, PurgeDoc>, ids: string[]) {
  return ids
    .map((id): SelectedDoc => ({ collection, id, updateTime: updateTimeOf(docs[id]) }))
    .sort(byRef);
}

function makeClass(rule: string, docs: SelectedDoc[]): SelectedClass {
  return { rule, action: 'delete', count: docs.length, docs };
}

function sortedIds(docs: Record<string, PurgeDoc>, keep: (doc: PurgeDoc) => boolean): string[] {
  return Object.keys(docs)
    .filter((id) => keep(docs[id]))
    .sort();
}

function stillHoldsSeat(ticket: PurgeDoc, nowMs: number): boolean {
  if (ticket.status === 'paid') return true;
  if (ticket.status !== 'reserved') return false;
  const at = timeOf(ticket.expiresAt);
  return at === null || at > nowMs;
}

function seatCounts(tickets: Record<string, PurgeDoc>, skip: Set<string>, nowMs: number) {
  const counts: Record<string, StockRow> = {};
  for (const id of Object.keys(tickets)) {
    if (skip.has(id) || !stillHoldsSeat(tickets[id], nowMs)) continue;
    const showId = String(tickets[id].showId ?? 'unknown');
    const ticketType = String(tickets[id].ticketType ?? 'unknown');
    const key = showId + '\u0000' + ticketType;
    counts[key] ??= { showId, ticketType, before: 0, after: 0 };
    counts[key].after += 1;
  }
  return counts;
}

export function stockDelta(
  tickets: Record<string, PurgeDoc>,
  selectedTicketIds: string[],
  now: string,
): StockRow[] {
  const nowMs = Date.parse(now);
  const before = seatCounts(tickets, new Set<string>(), nowMs);
  const after = seatCounts(tickets, new Set<string>(selectedTicketIds), nowMs);
  return Object.keys(before)
    .map((key): StockRow => ({
      showId: before[key].showId,
      ticketType: before[key].ticketType,
      before: before[key].after,
      after: after[key]?.after ?? 0,
    }))
    .filter((row) => row.before !== row.after)
    .sort((a, b) => (a.showId + a.ticketType).localeCompare(b.showId + b.ticketType));
}

function classifyOrders(orders: Record<string, PurgeDoc>, nowMs: number) {
  const reservedExpired: string[] = [];
  const heldGatewayRef: string[] = [];
  const heldFlaggedReal: string[] = [];
  const sandboxPaid: string[] = [];
  const heldPaid: string[] = [];
  for (const id of Object.keys(orders).sort()) {
    const order = orders[id];
    if (order.status === 'reserved' && isExpired(order, nowMs)) {
      const noGatewayTrace = isNil(order.gatewayPaymentId) && isNil(order.gatewayPending);
      if (isTestEvidence(order)) reservedExpired.push(id);
      else if (!noGatewayTrace) heldGatewayRef.push(id);
      else if (order.issuedInTestMode === false) heldFlaggedReal.push(id);
      else reservedExpired.push(id);
    } else if (order.status === 'paid') {
      if (isTestEvidence(order)) sandboxPaid.push(id);
      else if (isHeldPaid(order)) heldPaid.push(id);
    }
  }
  return { reservedExpired, heldGatewayRef, heldFlaggedReal, sandboxPaid, heldPaid };
}

function classifyOrphans(
  tickets: Record<string, PurgeDoc>,
  orders: Record<string, PurgeDoc>,
  cascaded: Set<string>,
  nowMs: number,
) {
  const selected: string[] = [];
  const held: string[] = [];
  for (const id of Object.keys(tickets).sort()) {
    const ticket = tickets[id];
    if (cascaded.has(id)) continue;
    const orderId = ticket.orderId;
    const orphan = isNil(orderId) || typeof orderId !== 'string' || !Object.hasOwn(orders, orderId);
    if (!orphan) continue;
    const reservedAndLapsed = ticket.status === 'reserved' && (isNil(ticket.expiresAt) || isExpired(ticket, nowMs));
    if (reservedAndLapsed) selected.push(id);
    else if (SETTLED_TICKET_STATUSES.includes(String(ticket.status)) || ticket.status === 'reserved') {
      held.push(id);
    }
  }
  return { selected, held };
}

export function selectPurge(snapshot: Snapshot, now: string): Selection {
  const nowMs = Date.parse(now);
  const { orders, tickets, vendorStandOrders } = snapshot.collections;

  const o = classifyOrders(orders, nowMs);
  const parents = new Set<string>([...o.reservedExpired, ...o.sandboxPaid]);
  const cascadeIds = sortedIds(tickets, (t) => typeof t.orderId === 'string' && parents.has(t.orderId));
  const orphans = classifyOrphans(tickets, orders, new Set<string>(cascadeIds), nowMs);

  const vsoSelected = sortedIds(
    vendorStandOrders,
    (v) => v.status === 'paid' && isTestEvidence(v),
  );
  const vsoHeld = sortedIds(
    vendorStandOrders,
    (v) => v.status === 'paid' && isHeldPaid(v),
  );

  const classes: Record<ClassId, SelectedClass> = {
    reservedExpired: makeClass('R1', toSelected('orders', orders, o.reservedExpired)),
    sandboxPaidOrders: makeClass('R2', toSelected('orders', orders, o.sandboxPaid)),
    orderPositions: makeClass('R3', toSelected('tickets', tickets, cascadeIds)),
    orphanPositions: makeClass('R4', toSelected('tickets', tickets, orphans.selected)),
    sandboxVendorStandOrders: makeClass('R5', toSelected('vendorStandOrders', vendorStandOrders, vsoSelected)),
  };
  const refs = (collection: PurgeCollection, ids: string[]): DocRef[] =>
    ids.map((id): DocRef => ({ collection, id })).sort(byRef);
  const heldBack: Record<string, DocRef[]> = {
    reservedExpiredWithGatewayRef: refs('orders', o.heldGatewayRef),
    paidWithoutTestEvidence: refs('orders', o.heldPaid),
    orphanPositionsNotPurgeable: refs('tickets', orphans.held),
    vendorStandOrdersPaidWithoutTestEvidence: refs('vendorStandOrders', vsoHeld),
  };
  // Emitted only when non-empty so the manifest shape stays identical to the golden.
  if (o.heldFlaggedReal.length > 0) {
    heldBack.reservedExpiredFlaggedReal = refs('orders', o.heldFlaggedReal);
  }

  const selectedTickets = [...cascadeIds, ...orphans.selected];
  const byCollection: Record<string, number> = { orders: 0, tickets: 0, vendorStandOrders: 0 };
  let selected = 0;
  for (const cls of Object.values(classes)) {
    selected += cls.count;
    for (const d of cls.docs) byCollection[d.collection] += 1;
  }
  const heldTotal = Object.values(heldBack).reduce((n, list) => n + list.length, 0);

  return {
    classes,
    heldBack,
    stockDelta: { note: STOCK_NOTE, rows: stockDelta(tickets, selectedTickets, now) },
    totals: { selected, heldBack: heldTotal, byCollection },
  };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(obj)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonicalJson(obj[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function digestOfClasses(classes: Record<string, unknown>): string {
  return hash('sha256', canonicalJson(classes));
}

export function digestOf(selection: Pick<Selection, 'classes'>): string {
  return digestOfClasses(selection.classes);
}

/**
 * Independent last line of defence, re-run on every doc immediately before it is deleted.
 * Test evidence overrides, except that a settled/real-looking doc with none is refused.
 */
export function hardGuard(
  collection: string,
  doc: PurgeDoc,
  now: string,
  options: GuardOptions = {},
): GuardResult {
  if (!(PURGEABLE_COLLECTIONS as readonly string[]).includes(collection)) {
    return { ok: false, reason: `collection ${collection} is not purgeable` };
  }
  const cascadedFromTest = options.parentIsTest === true && doc.issuedInTestMode !== false;
  if (isTestEvidence(doc) || cascadedFromTest) return { ok: true, reason: 'test evidence' };
  if (PROTECTED_STATUSES.includes(String(doc.status))) {
    return { ok: false, reason: `status ${String(doc.status)} without test evidence` };
  }
  if (!isNil(doc.gatewayPaymentId)) return { ok: false, reason: 'gatewayPaymentId set without test evidence' };
  if (!isNil(doc.gatewayPending)) return { ok: false, reason: 'gatewayPending set without test evidence' };
  if (doc.status === 'reserved' && !isNil(doc.expiresAt) && !isExpired(doc, Date.parse(now))) {
    return { ok: false, reason: 'live reservation hold without test evidence' };
  }
  return { ok: true, reason: 'no real-sale markers' };
}
