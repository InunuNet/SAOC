/**
 * Pure logic behind /admin/login's error copy and password reset. No firebase import, so
 * it can be unit-tested directly. The page owns every Firebase call; this module only
 * decides what the admin is told. Raw Firebase text (`err.message`) never leaves here.
 */

export const GENERIC_SIGN_IN_ERROR = 'Sign-in failed. Please try again.';
export const NETWORK_ERROR_MESSAGE = 'Network error — check your connection and try again.';

const INVALID_CREDENTIAL_MESSAGE = 'Email or password not recognised.';
const TOO_MANY_REQUESTS_MESSAGE = 'Too many attempts. Please wait a few minutes and try again.';
const RESET_RESPONSE_MESSAGE = 'If that address has an admin account, a reset link is on its way.';
const RESET_EMPTY_PROMPT_MESSAGE = 'Enter your email address first, then choose Forgot password.';

// Every code that means "these credentials did not work" maps to one string, so the
// response never reveals whether the email has an account.
const INVALID_CREDENTIAL_CODES: ReadonlySet<string> = new Set([
  'auth/invalid-credential',
  'auth/invalid-login-credentials',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-email',
  'auth/missing-password',
]);

export type PasswordResetResult = { status: 'prompt' | 'sent'; message: string };

export function firebaseErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

export function passwordSignInErrorMessage(err: unknown): string {
  const code = firebaseErrorCode(err);
  if (code !== undefined && INVALID_CREDENTIAL_CODES.has(code)) {
    return INVALID_CREDENTIAL_MESSAGE;
  }
  switch (code) {
    case 'auth/too-many-requests':
      return TOO_MANY_REQUESTS_MESSAGE;
    case 'auth/network-request-failed':
      return NETWORK_ERROR_MESSAGE;
    default:
      return GENERIC_SIGN_IN_ERROR;
  }
}

/**
 * Sends a reset email through the injected `send` and answers identically whether it
 * resolves or rejects, so the response cannot be used to probe which emails are admins.
 * Only the error code is logged — never the email or the error message.
 */
export async function requestPasswordReset(
  email: string,
  send: (email: string) => Promise<void>,
): Promise<PasswordResetResult> {
  const trimmed = email.trim();
  if (trimmed === '') {
    return { status: 'prompt', message: RESET_EMPTY_PROMPT_MESSAGE };
  }

  try {
    await send(trimmed);
  } catch (err: unknown) {
    console.error('Password reset request failed', { code: firebaseErrorCode(err) });
  }
  return { status: 'sent', message: RESET_RESPONSE_MESSAGE };
}
