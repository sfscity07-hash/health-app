type MaybeAuthError = { code?: string; message?: string; status?: number; name?: string } | null | undefined;

/** Turns Supabase auth errors into plain sentences that say what to do next. */
export function authErrorMessage(error: unknown): string {
  const e = error as MaybeAuthError;
  switch (e?.code) {
    case 'invalid_credentials':
      return "That email and password don't match. Check them and try again.";
    case 'user_already_exists':
    case 'email_exists':
      return 'There is already an account with this email. Sign in instead.';
    case 'weak_password':
      return 'Choose a stronger password: at least 8 characters.';
    case 'email_not_confirmed':
      return 'Confirm your email first using the link we sent, then sign in.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Check that the email address is typed correctly.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many attempts in a short time. Wait a minute and try again.';
    case 'signup_disabled':
      return 'New sign-ups are turned off for this Supabase project.';
  }
  if (e?.name === 'AuthRetryableFetchError' || /network|fetch/i.test(e?.message ?? '')) {
    return "Can't reach the server. Check your internet connection and try again.";
  }
  return e?.message ? `Something went wrong: ${e.message}` : 'Something went wrong. Please try again.';
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL.test(email.trim())) return 'Enter a valid email address.';
  if (password.length < 8) return 'Your password needs at least 8 characters.';
  return null;
}
