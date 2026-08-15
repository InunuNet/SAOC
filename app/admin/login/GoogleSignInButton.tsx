'use client';

interface GoogleSignInButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

/**
 * The official multi-colour Google "G" mark, reproduced at fixed proportions per
 * Google's Sign in with Google branding guidelines
 * (https://developers.google.com/identity/branding-guidelines): standard colour
 * gradient, never recoloured or redrawn, always on a light background, never used
 * standalone without the button boundary and label text.
 */
function GoogleLogo() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 18 18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8632-3.0477.8632-2.3436 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2823-1.71V4.9582H.9573A8.9965 8.9965 0 000 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z"
      />
      <path
        fill="#EA4335"
        d="M9 3.5786c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6564 3.5786 9 3.5786z"
      />
    </svg>
  );
}

/**
 * Presentational only — the auth call and the mintSession() convergence onto
 * /api/admin/session both live in app/admin/login/page.tsx, not here. This component
 * exists purely to keep page.tsx under the project's 150-line component cap; it must
 * never grow its own fetch/session logic.
 *
 * Styled to Google's "Light" custom-button theme (fill #FFFFFF, 1px inside stroke
 * #747775, text #1F1F1F) per the branding guidelines above — chosen over Dark/Neutral
 * because it reads as a clean, clearly-bounded white rectangle against this card's warm
 * ivory background (#f4f3ec), where Neutral's #F2F2F2 fill and no stroke would nearly
 * disappear into the surrounding tone. Shape is rectangular (one of the two permitted
 * shapes) with the site's usual `rounded-sm` radius so it sits in the same family as the
 * "Sign in" button above it, per the guideline that the button may be adapted in size
 * and radius as long as the "G" mark itself is never resized, recoloured, or redrawn.
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
        className="inline-flex min-h-[40px] w-full items-center justify-center gap-3 rounded-sm border border-[#747775] bg-white px-4 py-2.5 font-sans text-[14px] font-medium leading-5 text-[#1f1f1f] transition-colors duration-150 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <span aria-hidden="true">Signing in…</span>
        ) : (
          <>
            <GoogleLogo />
            <span>Sign in with Google</span>
          </>
        )}
      </button>
    </>
  );
}
