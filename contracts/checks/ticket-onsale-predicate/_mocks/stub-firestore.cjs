// Firestore stand-in: reads return an empty world; EVERY write path increments
// globalThis.__fsWrites and rejects, so a check can assert "zero writes" and a code path that
// reaches the reservation transaction fails loudly instead of touching anything real.
const WRITE_METHODS = new Set(['set', 'create', 'update', 'delete', 'runTransaction', 'batch', 'add']);

function node() {
  const target = function () {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (WRITE_METHODS.has(String(prop))) {
        return () => {
          globalThis.__fsWrites = (globalThis.__fsWrites ?? 0) + 1;
          return Promise.reject(new Error(`stub-firestore: write attempted via ${String(prop)}`));
        };
      }
      if (prop === 'get') {
        return async () => ({ exists: false, empty: true, docs: [], size: 0, data: () => undefined, forEach() {} });
      }
      return node();
    },
    apply() {
      return node();
    },
  });
}

function getFirestore() {
  return node();
}
function getAuth() {
  return node();
}
function getApps() {
  return [];
}
function getApp() {
  return {};
}
function initializeApp() {
  return {};
}
function cert() {
  return {};
}
const FieldValue = { serverTimestamp: () => 'ts', increment: (n) => n, delete: () => 'del' };
const Timestamp = {
  now: () => ({ toDate: () => new Date() }),
  fromDate: (d) => ({ toDate: () => d }),
};

module.exports = { getFirestore, getAuth, getApps, getApp, initializeApp, cert, FieldValue, Timestamp };
