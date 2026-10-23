import { redirect } from 'next/navigation';

import { PageHeader, PageShell } from '@/components/admin/PageHeader';
import { SettingsProfile } from '@/components/admin/SettingsProfile';
import { SettingsSignOut } from '@/components/admin/SettingsSignOut';
import { getAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings' };

const PROVIDER_LABELS: Record<string, string> = {
  password: 'Email and password',
  'google.com': 'Google',
  'microsoft.com': 'Microsoft',
  'apple.com': 'Apple',
};
const ALL_SHOWS_SCOPE = '*';
const NO_ROLES = 'No roles assigned';

/** One line per scope in a `roles` claim shaped Record<string, string[]>; anything else is no roles. */
function roleLinesFromClaim(roles: unknown): string[] {
  if (typeof roles !== 'object' || roles === null || Array.isArray(roles)) return [NO_ROLES];
  const lines: string[] = [];
  for (const [scope, names] of Object.entries(roles)) {
    if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) return [NO_ROLES];
    const scopeLabel = scope === ALL_SHOWS_SCOPE ? 'All shows' : scope;
    lines.push(`${scopeLabel}: ${names.join(', ')}`);
  }
  return lines.length > 0 ? lines : [NO_ROLES];
}

/**
 * /admin/settings -- general Settings, open to every signed-in admin (mission
 * payment-gateway-settings F2). Read-only profile from the verified session token, never from the
 * client. Payment settings live at /admin/payments behind their own owner-only gate.
 */
export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session.ok) {
    redirect('/admin/login');
  }

  const token = session.decodedToken;
  const provider = token.firebase?.sign_in_provider;
  const name = typeof token.name === 'string' && token.name !== '' ? token.name : null;

  return (
    <PageShell>
      <PageHeader title="Settings" />
      <div className="flex max-w-[520px] flex-col gap-4">
        <SettingsProfile
          name={name}
          email={token.email ?? null}
          providerLabel={provider ? (PROVIDER_LABELS[provider] ?? provider) : '—'}
          roleLines={roleLinesFromClaim(token.roles)}
          signOutLabel="Sign out"
          signOutHelp="Signing out ends your session on every device."
          signOutControl={<SettingsSignOut />}
        />
      </div>
    </PageShell>
  );
}
