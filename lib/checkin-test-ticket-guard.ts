export function decideTestTicketAdmission(input: {
  issuedInTestMode?: unknown;
  liveMode: boolean;
}): 'allow' | 'reject_test_ticket' {
  return input.liveMode && input.issuedInTestMode !== false ? 'reject_test_ticket' : 'allow';
}
