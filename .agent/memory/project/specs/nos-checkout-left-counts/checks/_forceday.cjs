// nos-checkout-left-counts amendment 2 test seam (QA input, hash-locked): a --require preload for a SECOND `next start` process that makes
// the aggregate sold-count read report one show day as sold out, on the SERVER, so page.tsx and the hub loader compute their real
// decisions from it (the in-flight RSC rewrite of soldout.mjs cannot reach page-level logic). It is never in the production code and is
// loaded only when NOS_LC_FORCE_DAY is set (_server.mjs serve(..., { forceDay })).
// What it does: wraps getFirestore() from 'firebase-admin/firestore' so that collection('tickets').where(...).where(...).get() returns
// FORCED_SOLD synthetic paid tickets of the Day Pass SKU for NOS_LC_FORCE_DAY and nothing else. Every other collection and call is the
// real, unmodified firebase-admin. It reads no real order and no person (the real tickets collection is not touched at all) and it
// writes nothing anywhere.
'use strict';
const Module = require('node:module');

const DAY = process.env.NOS_LC_FORCE_DAY;
const SLUG = 'day-visitor';
const FORCED_SOLD = 5000; // above any day cap, so remaining is 0
const SHOW = process.env.NOS_LC_FORCE_SHOW || '';

if (DAY) {
  const realLoad = Module._load;
  const cache = new WeakMap();
  const fakeQuery = () => {
    let status = null;
    const q = {
      where(field, _op, value) { if (field === 'status') status = value; return q; },
      async get() {
        const docs = status === 'paid' ? Array.from({ length: FORCED_SOLD }, () => ({ data: () => ({ ticketType: SLUG, chosenDay: DAY, status: 'paid', showId: SHOW }) })) : [];
        return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
      },
    };
    return q;
  };
  const wrapDb = (db) => new Proxy(db, {
    get(target, prop) {
      if (prop === 'collection') return (name, ...rest) => (name === 'tickets' ? fakeQuery() : Reflect.apply(target.collection, target, [name, ...rest]));
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  Module._load = function patched(request, parent, isMain) {
    const mod = realLoad.apply(this, arguments);
    // Next externalises firebase-admin and requires it by its resolved file path (…/firebase-admin/lib/firestore/index.js).
    if (!/(^firebase-admin\/firestore$)|(firebase-admin[^/]*\/lib\/firestore\/index\.js$)/.test(request)) return mod;
    if (!cache.has(mod)) {
      cache.set(mod, new Proxy(mod, {
        get(target, prop, receiver) {
          if (prop === 'getFirestore') return (...args) => wrapDb(target.getFirestore(...args));
          return Reflect.get(target, prop, receiver);
        },
      }));
    }
    return cache.get(mod);
  };
}
