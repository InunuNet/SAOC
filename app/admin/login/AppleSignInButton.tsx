'use client';

interface AppleSignInButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

/**
 * The Apple silhouette mark, reproduced per Apple's Human Interface Guidelines for
 * "Sign in with Apple"
 * (https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple).
 * Solid black fill only — never recoloured or redrawn, never used standalone without the
 * button boundary and label text.
 */
function AppleLogo() {
  return (
    // Path data: Bootstrap Icons "apple" glyph (https://icons.getbootstrap.com/icons/apple/),
    // MIT-licensed — Copyright (c) 2019-2024 The Bootstrap Authors
    // (https://github.com/twbs/icons/blob/main/LICENSE.md). The glyph is authored for
    // viewBox="0 0 16 16", which is why this SVG's viewBox is 16-based while the other two
    // sign-in buttons' marks are 18/21-based — do not "tidy" it to match; that mismatch is
    // what produced the malformed render this glyph replaced.
    <svg
      className="h-5 w-5 shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M11.182.008C11.148-.03 9.923.023 8.857 1.18c-1.066 1.156-.902 2.482-.878 2.516s1.52.087 2.475-1.258.762-2.391.728-2.43m3.314 11.733c-.048-.096-2.325-1.234-2.113-3.422s1.675-2.789 1.698-2.854-.597-.79-1.254-1.157a3.7 3.7 0 0 0-1.563-.434c-.108-.003-.483-.095-1.254.116-.508.139-1.653.589-1.968.607-.316.018-1.256-.522-2.267-.665-.647-.125-1.333.131-1.824.328-.49.196-1.422.754-2.074 2.237-.652 1.482-.311 3.83-.067 4.56s.625 1.924 1.273 2.796c.576.984 1.34 1.667 1.659 1.899s1.219.386 1.843.067c.502-.308 1.408-.485 1.766-.472.357.013 1.061.154 1.782.539.571.197 1.111.115 1.652-.105.541-.221 1.324-1.059 2.238-2.758q.52-1.185.473-1.282" />
    </svg>
  );
}

/**
 * Presentational only — the auth call and the mintSession() convergence onto
 * /api/admin/session both live in app/admin/login/page.tsx, not here. This component
 * exists purely to keep page.tsx under the project's 150-line component cap; it must
 * never grow its own fetch/session logic.
 *
 * Uses Apple's "White with outline" permitted button style (white fill, black mark and
 * text, 1px black-ish border) — architect decision, so this button reads as part of the
 * same family as the other two on this card's warm ivory background, rather than Apple's
 * default solid-black button standing apart. `min-h-[44px]` is deliberately taller than
 * the other two buttons' `min-h-[40px]`: Apple's HIG sets 44pt as a hard minimum tap
 * target for this specific button and it must not be shrunk to match its neighbours.
 */
export function AppleSignInButton({ onClick, disabled, loading }: AppleSignInButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Sign in with Apple"
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-3 rounded-sm border border-black bg-white px-4 py-2.5 font-sans text-[14px] font-medium leading-5 text-black transition-colors duration-150 hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span aria-hidden="true">Signing in…</span>
      ) : (
        <>
          <AppleLogo />
          <span>Sign in with Apple</span>
        </>
      )}
    </button>
  );
}
