'use client';

import { BUTTON_SECONDARY } from '@/components/admin/tokens';
import { useAdminSignOut } from '@/components/admin/useAdminSignOut';

/** The one sign-out control on the Settings page; reuses the shell's sign-out flow unchanged. */
export function SettingsSignOut() {
  const signOut = useAdminSignOut();
  return (
    <button type="button" onClick={() => void signOut()} className={BUTTON_SECONDARY}>
      Sign out
    </button>
  );
}
