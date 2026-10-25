/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS require hook for offline checks */
const ACTIVE_GATEWAY_COLLECTION = 'adminSettings';
const ACTIVE_GATEWAY_DOC_ID = 'activePaymentGateway';
const GATEWAY_IDS = ['ozow', 'payfast'];
function isValidGatewayId(value) {
  return GATEWAY_IDS.includes(value);
}
async function resolveActiveGateway() {
  return 'ozow';
}

module.exports = { isValidGatewayId, resolveActiveGateway, ACTIVE_GATEWAY_DOC_ID, GATEWAY_IDS };
