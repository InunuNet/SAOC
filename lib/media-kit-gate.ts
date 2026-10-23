// lib/media-kit-gate.ts
// Mission nos-site-split F4 — both media kits (SAOC /media-kit, NOS /media-kit) are for verified
// admins only until a members system exists. The decision is getAdminSession(), the one shared admin
// authorisation (docs/admin-access.md); a visitor without it is redirected (307) to /admin/login on
// the SAME host, carrying the public path they asked for so sign-in returns them to it. No second
// auth path, fails closed.

import { redirect } from 'next/navigation';

import { getAdminSession } from './admin-auth';
import { safeNextPath } from './safe-next-path';

const ADMIN_LOGIN_PATH = '/admin/login';

/** The login URL for a visitor who must sign in first; `publicPath` is the path on the current host. */
export function mediaKitLoginPath(publicPath: string): string {
  return `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(safeNextPath(publicPath))}`;
}

/** Call first in a media kit page: returns for a verified admin, otherwise redirects and never returns. */
export async function requireMediaKitAccess(publicPath: string): Promise<void> {
  const session = await getAdminSession();
  if (!session.ok) redirect(mediaKitLoginPath(publicPath));
}
