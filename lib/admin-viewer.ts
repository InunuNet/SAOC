// F16: "is the person viewing this page a verified admin?" for admin-only affordances on public
// pages (the Ozow test-mode strip). A thin, fail-closed wrapper over getAdminSession(), the one
// shared admin authorisation decision (docs/admin-access.md). No second auth path.
import { getAdminSession, type AdminAuthResult } from './admin-auth';

export async function viewerIsVerifiedAdmin(
  resolveSession: () => Promise<AdminAuthResult> = getAdminSession,
): Promise<boolean> {
  try {
    const session = await resolveSession();
    return session.ok === true;
  } catch (error) {
    console.error('[admin-viewer] session lookup failed; treating viewer as public', {
      operation: 'viewerIsVerifiedAdmin',
      errorType: error instanceof Error ? error.name : typeof error,
    });
    return false;
  }
}
