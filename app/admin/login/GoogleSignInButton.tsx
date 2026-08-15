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
      <div className="my-6 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-rule" />
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label="Sign in with Google"
        className="w-full rounded-sm border border-primary/30 px-4 py-2.5 font-sans text-[14px] font-medium text-primary transition-colors duration-150 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </button>
    </>
  );
}
