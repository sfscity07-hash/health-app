import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { AuthForm } from '@/features/auth/AuthForm';
import { authErrorMessage, validateCredentials } from '@/features/auth/errors';

const mockAuth = {
  signUp: jest.fn(),
  signInWithPassword: jest.fn(),
};

jest.mock('@/lib/supabase', () => ({
  supabase: null,
  requireSupabase: () => ({ auth: mockAuth }),
}));

jest.mock('expo-router', () => ({ router: { back: jest.fn(), replace: jest.fn(), push: jest.fn() } }));

beforeEach(() => {
  mockAuth.signUp.mockReset();
  mockAuth.signInWithPassword.mockReset();
});

describe('credential checks', () => {
  it('asks for a real email and an 8+ character password', () => {
    expect(validateCredentials('nope', 'longenough')).toMatch(/valid email/);
    expect(validateCredentials('me@example.com', 'short')).toMatch(/8 characters/);
    expect(validateCredentials(' me@example.com ', 'longenough')).toBeNull();
  });

  it('turns Supabase errors into plain language', () => {
    expect(authErrorMessage({ code: 'invalid_credentials' })).toMatch(/don't match/);
    expect(authErrorMessage({ code: 'user_already_exists' })).toMatch(/Sign in instead/);
    expect(authErrorMessage({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toMatch(/internet/);
    expect(authErrorMessage({ code: '22P02', message: 'invalid input value for enum goal_type: "recomp"' })).toMatch(
      /missing an update/,
    );
  });
});

describe('AuthForm', () => {
  it('does not call Supabase when the form is invalid', async () => {
    const user = userEvent.setup();
    await render(<AuthForm mode="sign-in" />);
    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed, lower-cased email', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    await render(<AuthForm mode="sign-in" />);
    await user.type(screen.getByLabelText('Email'), ' Manny@Example.com ');
    await user.type(screen.getByLabelText('Password'), 'correct horse');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'manny@example.com', password: 'correct horse' }),
    );
  });

  it('shows a friendly message when the password is wrong', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    const user = userEvent.setup();
    await render(<AuthForm mode="sign-in" />);
    await user.type(screen.getByLabelText('Email'), 'me@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong password');
    await user.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/don't match/)).toBeOnTheScreen();
  });

  it('explains the confirmation email when sign-up returns no session', async () => {
    mockAuth.signUp.mockResolvedValue({ data: { user: { id: 'u1' }, session: null }, error: null });
    const user = userEvent.setup();
    await render(<AuthForm mode="sign-up" />);
    await user.type(screen.getByLabelText('Email'), 'me@example.com');
    await user.type(screen.getByLabelText('Password'), 'a good password');
    await user.press(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/Check your inbox/)).toBeOnTheScreen();
  });
});
