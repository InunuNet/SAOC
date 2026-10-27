// lib/data/tickets stand-in for f6-stock-pool.mts: the two sold-count readers the hub loader uses,
// answering from globalThis.__f6Scenario.sold.
async function getSoldCountsByTicketType() {
  return { ...globalThis.__f6Scenario.sold };
}

async function getSoldCountsByTicketTypeAndDay() {
  return {};
}

module.exports = { getSoldCountsByTicketType, getSoldCountsByTicketTypeAndDay };
