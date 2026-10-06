import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import OnboardingScreen from '@/app/onboarding';

const mockMutateAsync = jest.fn();

jest.mock('@/lib/supabase', () => ({ supabase: null, requireSupabase: jest.fn() }));
jest.mock('@/features/profile/api', () => ({
  useSaveOnboarding: () => ({ mutateAsync: mockMutateAsync, isPending: false, isError: false, error: null }),
}));

describe('onboarding', () => {
  it('walks from goal to a saved plan', async () => {
    mockMutateAsync.mockResolvedValue({});
    const user = userEvent.setup();
    await render(<OnboardingScreen />);

    // Goal: a single tap moves on by itself.
    await user.press(screen.getByRole('radio', { name: /Lose weight/ }));
    expect(await screen.findByText('A bit about you')).toBeOnTheScreen();

    // About you: Continue is blocked until it's complete.
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/metabolism estimate/)).toBeOnTheScreen();
    await user.press(screen.getByRole('radio', { name: 'Male' }));
    await user.type(screen.getByLabelText('Age'), '30');
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    // Body
    expect(await screen.findByText('Height and weight')).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Height'), '180');
    await user.type(screen.getByLabelText('Current weight'), '80');
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    // Activity: auto-advances.
    await user.press(await screen.findByRole('radio', { name: /Moderately active/ }));

    // Target
    expect(await screen.findByText('Where are you heading?')).toBeOnTheScreen();
    await user.type(screen.getByLabelText('Goal weight'), '85');
    await user.press(screen.getByRole('radio', { name: /Steady/ }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/below your current weight/)).toBeOnTheScreen();
    await user.clear(screen.getByLabelText('Goal weight'));
    await user.type(screen.getByLabelText('Goal weight'), '75');
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    // Reveal: 2210 suggested, nudged up once by 50.
    expect(await screen.findByText('Your daily budget')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Raise by 50 kcal' }));
    await user.press(screen.getByRole('button', { name: 'Start tracking' }));

    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    const saved = mockMutateAsync.mock.calls[0][0];
    expect(saved.calories).toBe(2260);
    expect(saved.units).toBe('metric');
    expect(saved.plan).toMatchObject({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, goal: 'lose', kgPerWeek: 0.5, goalWeightKg: 75 });
    expect(saved.macros.protein_g).toBe(144);
  });

  it('keeps answers when switching units', async () => {
    const user = userEvent.setup();
    await render(<OnboardingScreen />);
    await user.press(screen.getByRole('radio', { name: /Maintain/ }));
    await user.press(await screen.findByRole('radio', { name: 'Female' }));
    await user.type(screen.getByLabelText('Age'), '28');
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    await user.type(await screen.findByLabelText('Height'), '170');
    await user.type(screen.getByLabelText('Current weight'), '68');
    await user.press(screen.getByRole('radio', { name: 'lb · ft' }));
    expect(screen.getByLabelText('Current weight')).toHaveDisplayValue('149.9');
    expect(screen.getByLabelText('Height')).toHaveDisplayValue('5');
    expect(screen.getByLabelText('Height, inches')).toHaveDisplayValue('7');
  });
});
