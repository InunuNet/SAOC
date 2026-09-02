import { getCollectionMap, FakeTimestamp, INCREMENT } from './store.mjs';

export const Timestamp = FakeTimestamp;

export const FieldValue = {
  increment: (by) => ({ [INCREMENT]: by }),
};

// vendor-stand-payment-confirm-gate (F6) addition -- lets a check simulate Firestore's real
// contention-retry behaviour: `runTransaction(fn)` replays `fn` from scratch, discarding every
// prior attempt's reads/writes, and applies ONLY the final, successfully-committing attempt's
// writes. Real Firestore does this transparently on write conflicts; this fixture's original
// `runTransaction` called `fn` exactly once, which cannot reproduce a defect whose failure mode
// depends on the callback running MORE than once per external request -- e.g. an external I/O
// call inside the callback (paymentProvider.confirmNotification()) firing once per attempt, with
// only the LAST attempt's Firestore writes ever landing. One-shot: consumed by the very next
// `runTransaction` call and reset to 0 immediately, whether or not a check explicitly resets it,
// so a check that forgets to reset between scenarios cannot leak retries into an unrelated one.
let pendingRetryCount = 0;
export function simulateTransactionRetries(count) {
  pendingRetryCount = count;
}

function applyPatch(map, id, patch) {
  const current = map.get(id);
  if (!current) throw new Error(`no such doc: ${id}`);
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && INCREMENT in value) {
      const prior = typeof current[key] === 'number' ? current[key] : 0;
      current[key] = prior + value[INCREMENT];
    } else {
      current[key] = value;
    }
  }
}

function snapshotOf(map, id) {
  return {
    exists: map.has(id),
    id,
    data: () => (map.has(id) ? { ...map.get(id) } : undefined),
  };
}

function docRef(collectionName, id) {
  const map = getCollectionMap(collectionName);
  return {
    id,
    // Not a real firebase-admin field -- this harness's own way of letting runTransaction's
    // get/set/update resolve which in-memory collection a ref belongs to, since a transaction
    // callback here (M3) now spans MULTIPLE collections (vendorStandOrders AND
    // vendorSubmissions), unlike the original single-collection fixture.
    __collection: collectionName,
    get: async () => snapshotOf(map, id),
    set: async (data) => {
      map.set(id, { ...data });
    },
    update: async (patch) => applyPatch(map, id, patch),
  };
}

function collection(collectionName) {
  const map = getCollectionMap(collectionName);
  const filters = [];
  const query = {
    where(field, _op, value) {
      filters.push([field, value]);
      return query;
    },
    get: async () => ({
      docs: [...map.entries()]
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => ({ id, data: () => ({ ...data }) })),
    }),
    doc: (id) => docRef(collectionName, id),
  };
  return query;
}

export function getFirestore() {
  return {
    collection,
    runTransaction: async (fn) => {
      const retries = pendingRetryCount;
      pendingRetryCount = 0;

      for (let attempt = 0; attempt < retries; attempt++) {
        // A DISCARDED attempt -- reads see the current committed store state (nothing else
        // mutates it mid-simulation), writes are staged into a throwaway object never applied
        // to the real store. Any non-Firestore side effect the callback performs (an external
        // call, a console.error, a closure over an outer `let` the production handler resets
        // per-attempt) still runs for real -- Firestore's retry machinery has no way to undo
        // those, which is precisely the property this simulation exists to exercise.
        await fn({
          get: async (ref) => snapshotOf(getCollectionMap(ref.__collection), ref.id),
          set: () => {},
          update: () => {},
        });
      }

      // The FINAL, committing attempt -- writes applied exactly as the pre-F6 fixture always did.
      return fn({
        get: async (ref) => snapshotOf(getCollectionMap(ref.__collection), ref.id),
        set: (ref, data) => {
          getCollectionMap(ref.__collection).set(ref.id, { ...data });
        },
        update: (ref, patch) => applyPatch(getCollectionMap(ref.__collection), ref.id, patch),
      });
    },
  };
}
