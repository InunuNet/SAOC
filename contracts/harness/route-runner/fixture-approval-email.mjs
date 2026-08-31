// Captures what the approval email WOULD have been sent, so the harness can read the code the
// vendor actually receives -- instead of the code the route happens to have in a local.
export const sentEmails = [];
export async function sendVendorApprovalConfirmationEmail(input) {
  sentEmails.push(input);
}
