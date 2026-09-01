// In-memory multi-collection Firestore stand-in, shared by every fixture. Generalised (M3,
// vendor-gated-registration-flow) from the original single `vendorApplications`-only store so
// the same harness can exercise vendorApplications, vendorSubmissions and vendorStandOrders
// documents inside ONE transaction, the way the real settlement handler
// (lib/vendor-stand-payment-notification.ts) does.
const collections = new Map();

export function getCollectionMap(name) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name);
}

export function resetAllCollections() {
  for (const map of collections.values()) map.clear();
}

// Named convenience exports, preserved for the existing M4 demo script -- each IS the same Map
// getCollectionMap('vendorApplications') returns, not a copy.
export const applications = getCollectionMap('vendorApplications');
export const vendorSubmissions = getCollectionMap('vendorSubmissions');
export const vendorStandOrders = getCollectionMap('vendorStandOrders');

export class FakeTimestamp {
  constructor(date) {
    this.date = date;
  }
  static fromDate(date) {
    return new FakeTimestamp(date);
  }
  static now() {
    return new FakeTimestamp(new Date());
  }
  toDate() {
    return this.date;
  }
}

export const INCREMENT = Symbol('increment');
