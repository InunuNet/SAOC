import { applications, FakeTimestamp, INCREMENT } from './store.mjs';

export const Timestamp = FakeTimestamp;

export const FieldValue = {
  increment: (by) => ({ [INCREMENT]: by }),
};

function applyPatch(id, patch) {
  const current = applications.get(id);
  if (!current) throw new Error(`no such application: ${id}`);
  for (const [key, value] of Object.entries(patch)) {
    if (value && typeof value === 'object' && INCREMENT in value) {
      const prior = typeof current[key] === 'number' ? current[key] : 0;
      current[key] = prior + value[INCREMENT];
    } else {
      current[key] = value;
    }
  }
}

function docRef(id) {
  return {
    id,
    get: async () => ({
      exists: applications.has(id),
      id,
      data: () => (applications.has(id) ? { ...applications.get(id) } : undefined),
    }),
    update: async (patch) => applyPatch(id, patch),
  };
}

function collection() {
  const filters = [];
  const query = {
    where(field, _op, value) { filters.push([field, value]); return query; },
    get: async () => ({
      docs: [...applications.entries()]
        .filter(([, data]) => filters.every(([field, value]) => data[field] === value))
        .map(([id, data]) => ({ id, data: () => ({ ...data }) })),
    }),
    doc: docRef,
  };
  return query;
}

export function getFirestore() {
  return {
    collection,
    runTransaction: async (fn) =>
      fn({
        get: async (ref) => ({ data: () => ({ ...(applications.get(ref.id) ?? {}) }) }),
        update: (ref, patch) => applyPatch(ref.id, patch),
      }),
  };
}
