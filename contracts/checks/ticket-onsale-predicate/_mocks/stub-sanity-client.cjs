// Sanity client stand-in. Dispatches on the query text the app imports from sanity/queries.ts and
// answers from goldens/catalogue.json. An unrecognised query returns null and is recorded in
// globalThis.__unhandledQueries so a check can fail on silent drift.
const { readFileSync } = require('node:fs');
const path = require('node:path');

const catalogue = JSON.parse(
  readFileSync(
    path.join(__dirname, '../../../../.agent/memory/project/specs/ticket-onsale-predicate/goldens/catalogue.json'),
    'utf8'
  )
);

function overrides() {
  return globalThis.__catalogueOverrides ?? {};
}

// A real GROQ projection returns ONLY the fields the query names. Honour that, so a field the app
// forgot to select (e.g. demo, active) is absent here exactly as it would be from Sanity.
function project(doc, query) {
  const body = query.slice(query.lastIndexOf('{') + 1, query.lastIndexOf('}'));
  const keys = body
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(':') ? part.split(':')[0].replace(/"/g, '').trim() : part));
  const out = {};
  for (const key of keys) if (key in doc) out[key] = doc[key];
  return out;
}

const client = {
  async fetch(query, params = {}) {
    globalThis.__sanityQueries = [...(globalThis.__sanityQueries ?? []), String(query)];
    const q = String(query).replace(/\s+/g, ' ');
    if (q.includes('"nationalShow"][0]{ salesOpen }')) {
      return { salesOpen: overrides().salesOpen ?? catalogue.salesOpen };
    }
    if (q.includes('*[_type == "show"]')) {
      return catalogue.shows;
    }
    if (q.includes('"ticketType" && slug.current == $slug')) {
      const doc = catalogue.ticketTypes.find((t) => t.slug === params.slug && t.active === true);
      if (!doc) return null;
      return project(doc, q);
    }
    if (q.includes('"ticketType" && active == true && (category == $category')) {
      return catalogue.ticketTypes
        .filter((t) => t.active === true && (t.category ?? 'admission') === params.category)
        .map((t) => project(t, q));
    }
    if (q.includes('ticketsPage')) return {};
    globalThis.__unhandledQueries = [...(globalThis.__unhandledQueries ?? []), q.slice(0, 120)];
    return null;
  },
};

module.exports = { client };
