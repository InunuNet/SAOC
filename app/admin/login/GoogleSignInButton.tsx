'use client';

interface GoogleSignInButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

/**
 * Presentational only — the auth call and the mintSession() convergence onto
 * /api/admin/session both live in app/admin/login/page.tsx, not here. This component
 * exists purely to keep page.tsx under the project's 150-line component cap; it must
 * never grow its own fetch/session logic.
 */
export function GoogleSignInButton({ onClick, disabled, loading }: GoogleSignInButtonProps) {
  return (
    <>
      <div style={{ margin: '1.5rem 0', textAlign: 'center', color: '#666' }} aria-hidden="true">
        or
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Sign in with Google"
        style={{ width: '100%', padding: '0.5rem 1.5rem' }}
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </>
  );
}
