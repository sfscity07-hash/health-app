import { render, screen, userEvent } from '@testing-library/react-native';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success' },
}));

describe('UI components', () => {
  it('Button shows its label and trailing value and responds to presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Add to Dinner" trailing="309 kcal" onPress={onPress} />);
    const button = screen.getByRole('button', { name: /Add to Dinner/ });
    expect(screen.getByText('309 kcal')).toBeOnTheScreen();
    await userEvent.setup().press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('a disabled Button ignores presses', async () => {
    const onPress = jest.fn();
    await render(<Button label="Add" disabled onPress={onPress} />);
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('SegmentedControl marks the selected option and reports changes', async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedControl
        label="Theme"
        value="dark"
        onChange={onChange}
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await userEvent.setup().press(screen.getByRole('radio', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('EmptyState explains what will appear', async () => {
    await render(<EmptyState icon="book" title="Nothing logged yet" body="Tap + to add breakfast." />);
    expect(screen.getByText('Nothing logged yet')).toBeOnTheScreen();
    expect(screen.getByText('Tap + to add breakfast.')).toBeOnTheScreen();
  });
});
