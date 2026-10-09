import { act, render, screen, userEvent } from '@testing-library/react-native';

import { RemindersCard } from '@/components/profile/RemindersCard';
import { useReminderSettings } from '@/store/reminders';
import { useToast } from '@/store/toast';

const permission = { granted: true };
jest.mock('@/features/reminders/notify', () => ({
  remindersSupported: true,
  ensurePermission: jest.fn(async () => permission.granted),
}));

describe('Reminders on the phone', () => {
  it('asks for permission when you turn one on, then lets you move its time', async () => {
    const user = userEvent.setup();
    await render(<RemindersCard />);
    expect(screen.getAllByRole('switch')).toHaveLength(4);

    await user.press(screen.getByRole('switch', { name: 'Log your lunch' }));
    expect(useReminderSettings.getState().settings.lunch).toEqual({ on: true, time: '13:30' });
    expect(screen.getByText(/Daily at 1:30 pm/)).toBeOnTheScreen();

    await user.press(screen.getByRole('button', { name: 'More time' }));
    expect(useReminderSettings.getState().settings.lunch.time).toBe('13:45');
    expect(screen.getByLabelText('Time: 1:45 pm')).toBeOnTheScreen();
  });

  it('stays off and says why when notifications are blocked', async () => {
    permission.granted = false;
    const user = userEvent.setup();
    await render(<RemindersCard />);
    await user.press(screen.getByRole('switch', { name: 'Finish your day' }));
    expect(useReminderSettings.getState().settings.finish.on).toBe(false);
    await act(async () => {});
    expect(useToast.getState().message).toMatch(/Notifications are off/);
  });
});
