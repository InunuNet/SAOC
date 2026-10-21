// Shared fakes for the footer-newsletter-subscribe handler checks.
export function makeDeps(over = {}) {
  const store = new Map();
  const attempts = [];
  const calls = { get: 0, write: 0, find: 0, mark: 0, logs: [] };
  let n = 0;
  const deps = {
    now: new Date('2027-01-05T00:00:00Z'),
    getPriorAttempts: (key) => attempts.filter((a) => a.key === key),
    recordAttempt: (key, at) => { attempts.push({ key, at }); },
    getSubscriber: async (id) => { calls.get++; return store.get(id) ?? null; },
    writeSubscriber: async (id, doc) => { calls.write++; store.set(id, doc); },
    generateToken: () => String(++n).padStart(43, 'T'),
    findByToken: async (token) => {
      calls.find++;
      for (const [id, d] of store) if (d.unsubscribeToken === token) return { id, status: d.status };
      return null;
    },
    markUnsubscribed: async (id, now) => {
      calls.mark++;
      const d = store.get(id);
      store.set(id, { ...d, status: 'unsubscribed', unsubscribedAt: now });
    },
    logError: (message, context) => { calls.logs.push(JSON.stringify([message, context])); },
    ...over,
  };
  return { deps, store, attempts, calls };
}
