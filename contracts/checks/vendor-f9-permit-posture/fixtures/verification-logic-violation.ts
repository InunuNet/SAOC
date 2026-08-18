// FIXTURE — VIOLATION. Self-test golden for check-no-verification-logic-exists.mjs. The
// scanner must flag this file's contents as forbidden verification/lookup logic.
export async function verifyCitesPermit(permitNumber: string): Promise<boolean> {
  const res = await fetch(`https://cites.org/api/permits/${permitNumber}`);
  return res.ok;
}
