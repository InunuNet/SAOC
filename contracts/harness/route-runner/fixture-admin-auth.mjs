export async function getAdminSession() {
  return { ok: true, decodedToken: { email: 'reviewer@saoc.co.za' } };
}
export function hasCapability() { return true; }
