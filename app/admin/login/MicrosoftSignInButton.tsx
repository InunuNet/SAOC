'use client';

interface MicrosoftSignInButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

/**
 * The official Microsoft four-square mark, reproduced at fixed proportions per Microsoft's
 * sign-in branding guidance
 * (https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-branding-in-apps):
 * top-left #F25022, top-right #7FBA00, bottom-left #00A4EF, bottom-right #FFB900. Never
 * recoloured or redrawn, never used standalone without the button boundary and label text.
 */
function MicrosoftLogo() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 21 21"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

/**
 * Presentational only — the auth call and the mintSession() convergence onto
 * /api/admin/session both live in app/admin/login/page.tsx, not here. This component
 * exists purely to keep page.tsx under the project's 150-line component cap; it must
 * never grow its own fetch/session logic.
 *
 * Styled to match GoogleSignInButton's "Light" theme (fill #FFFFFF, 1px border #8C8C8C,
 * text #5E5E5E) so the three federated buttons read as one family on this card's warm
 * ivory background, per the architect's decision that all three should look consistent
 * rather than each following its own vendor's default theme.
 */
export function MicrosoftSignInButton({ onClick, disabled, loading }: MicrosoftSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Sign in with Microsoft"
      className="inline-flex min-h-[40px] w-full items-center justify-center gap-3 rounded-sm border border-[#8C8C8C] bg-white px-4 py-2.5 font-sans text-[14px] font-medium leading-5 text-[#5E5E5E] transition-colors duration-150 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span aria-hidden="true">Signing in…</span>
      ) : (
        <>
          <MicrosoftLogo />
          <span>Sign in with Microsoft</span>
        </>
      )}
    </button>
  );
}
