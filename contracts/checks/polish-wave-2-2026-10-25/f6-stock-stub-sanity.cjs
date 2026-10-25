// Sanity client stand-in for f6-stock-pool.mts: serves globalThis.__f6Scenario.ticketTypes for the
// hub's category query, the show list, and the sales switch. Pool-sibling lookups return no extra types.
const client = {
  async fetch(query) {
    const q = String(query).replace(/\s+/g, ' ');
    const scenario = globalThis.__f6Scenario;
    if (q.includes('"nationalShow"][0]{ salesOpen }')) return { salesOpen: true };
    if (q.includes('*[_type == "show"]')) return scenario.shows;
    if (q.includes('capacityPool == $pool')) return [];
    if (q.includes('"ticketType" && active == true && (category == $category')) return scenario.ticketTypes;
    return null;
  },
};

module.exports = { client };
