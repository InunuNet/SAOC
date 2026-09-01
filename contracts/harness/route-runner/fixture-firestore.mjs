import { getCollectionMap, FakeTimestamp, INCREMENT } from './store.mjs';

export const Timestamp = FakeTimestamp;

export const FieldValue = {
  increment: (by) => ({ [INCREMENT]: by }),
};

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
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => snapshotOf(getCollectionMap(ref.__collection), ref.id),
        set: (ref, data) => {
          getCollectionMap(ref.__collection).set(ref.id, { ...data });
        },
        update: (ref, patch) => applyPatch(getCollectionMap(ref.__collection), ref.id, patch),
      }),
  };
}
