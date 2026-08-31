// In-memory stand-in for the vendorApplications collection, shared by both fixtures.
export const applications = new Map();

export class FakeTimestamp {
  constructor(date) { this.date = date; }
  static fromDate(date) { return new FakeTimestamp(date); }
  toDate() { return this.date; }
}

export const INCREMENT = Symbol('increment');
