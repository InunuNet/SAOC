'use client';

import type { FederatedProviderId } from './page';
import { AppleSignInButton } from './AppleSignInButton';
import { GoogleSignInButton } from './GoogleSignInButton';
import { MicrosoftSignInButton } from './MicrosoftSignInButton';

interface FederatedSignInButtonsProps {
  onSignIn: (id: FederatedProviderId) => void;
  disabled: boolean;
  federatedLoading: FederatedProviderId | null;
}

/**
 * Presentational only — stacks the three federated sign-in buttons under the single "or"
 * divider (rendered once, by GoogleSignInButton, since it's first in the stack). Extracted
 * purely to keep page.tsx under the project's 150-line component cap (see F5 architect
 * brief); no fetch/session logic lives here — that stays in page.tsx's
 * handleFederatedSignIn / mintSession, so there is exactly one session-mint path.
 */
export function FederatedSignInButtons({
  onSignIn,
  disabled,
  federatedLoading,
}: FederatedSignInButtonsProps) {
  return (
    <div className="space-y-3">
      <GoogleSignInButton
        onClick={() => onSignIn('google.com')}
        disabled={disabled}
        loading={federatedLoading === 'google.com'}
      />
      <MicrosoftSignInButton
        onClick={() => onSignIn('microsoft.com')}
        disabled={disabled}
        loading={federatedLoading === 'microsoft.com'}
      />
      <AppleSignInButton
        onClick={() => onSignIn('apple.com')}
        disabled={disabled}
        loading={federatedLoading === 'apple.com'}
      />
    </div>
  );
}
