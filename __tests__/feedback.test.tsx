import { render, screen, userEvent } from '@testing-library/react-native';

import { deviceLabel, feedbackProblem, sendErrorMessage, sentAt, type Feedback } from '@/features/feedback/logic';

const mockSend = { mutate: jest.fn(), isPending: false };
const mockList = { data: [] as Feedback[], isPending: false, isError: false, error: null };
const mockReader = { data: false };

jest.mock('@/features/feedback/api', () => ({
  useSendFeedback: () => mockSend,
  useFeedbackList: () => mockList,
  useFeedbackReader: () => mockReader,
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), push: jest.fn() }, useLocalSearchParams: () => ({ from: 'dashboard' }), useIsFocused: () => true }));

// Imported after the mocks.
// eslint-disable-next-line import/first
import FeedbackScreen from '@/app/feedback';

const item = (over: Partial<Feedback>): Feedback => ({
  id: 'f1',
  user_id: 'u1',
  email: 'friend@example.com',
  kind: 'bug',
  message: 'The + on Lunch added to Dinner',
  screen: 'dashboard',
  app_version: '1.0.0',
  device: 'Android 14 · Google Pixel 7',
  created_at: new Date().toISOString(),
  ...over,
});

beforeEach(() => {
  mockSend.mutate.mockReset();
  mockList.data = [];
  mockReader.data = false;
});

describe('feedback rules', () => {
  it('needs a few words, and not a novel', () => {
    expect(feedbackProblem('   ')).toMatch(/few words/);
    expect(feedbackProblem('x'.repeat(4001))).toMatch(/1 characters too long/);
    expect(feedbackProblem('Search is slow')).toBeNull();
  });

  it('names the phone without repeating the brand', () => {
    expect(deviceLabel('android', 34, { Release: '14', Brand: 'google', Model: 'Pixel 7' })).toBe('Android 14 · Google Pixel 7');
    expect(deviceLabel('android', 33, { Release: '13', Brand: 'samsung', Model: 'SM-A536E' })).toBe('Android 13 · Samsung SM-A536E');
    expect(deviceLabel('android', 34, { Release: '14', Brand: 'OnePlus', Model: 'OnePlus 11' })).toBe('Android 14 · OnePlus 11');
    expect(deviceLabel('android', 34)).toBe('Android 34');
    expect(deviceLabel('web', '')).toBe('Web');
  });

  it('explains why it didn’t send', () => {
    expect(sendErrorMessage({ code: 'P0001', message: 'feedback_limit: 20 messages a day' })).toMatch(/20 messages today/);
    expect(sendErrorMessage({ code: 'PGRST205', message: 'Could not find the table public.feedback' })).toMatch(/newest SQL/);
    expect(sendErrorMessage(new TypeError('Network request failed'))).toMatch(/still here/);
  });

  it('says when it was sent', () => {
    const now = new Date(2026, 9, 15, 18, 0);
    expect(sentAt(new Date(2026, 9, 15, 17, 59, 40).toISOString(), now)).toBe('Just now');
    expect(sentAt(new Date(2026, 9, 15, 17, 48).toISOString(), now)).toBe('12 min ago');
    expect(sentAt(new Date(2026, 9, 15, 9, 5).toISOString(), now)).toBe('Today, 09:05');
    expect(sentAt(new Date(2026, 9, 14, 21, 30).toISOString(), now)).toBe('Yesterday, 21:30');
    expect(sentAt(new Date(2026, 9, 3, 8, 0).toISOString(), now)).toBe('3 Oct, 08:00');
    expect(sentAt(new Date(2025, 11, 31, 8, 0).toISOString(), now)).toBe('31 Dec 2025, 08:00');
  });
});

describe('Feedback screen', () => {
  it('sends the message with its kind, the screen it came from, the app version and the phone', async () => {
    await render(<FeedbackScreen />);
    const user = userEvent.setup();
    await user.press(screen.getByRole('radio', { name: 'Idea' }));
    await user.type(screen.getByLabelText('Your idea'), 'Show salt in grams on the food screen');
    await user.press(screen.getByRole('button', { name: 'Send' }));
    expect(mockSend.mutate).toHaveBeenCalledTimes(1);
    const [sent] = mockSend.mutate.mock.calls[0];
    expect(sent).toMatchObject({ kind: 'idea', message: 'Show salt in grams on the food screen', screen: 'dashboard' });
    expect(sent.app_version).toMatch(/^1\.0\.0/);
    expect(typeof sent.device).toBe('string');
  });

  it('shows you what you sent, without anyone else’s details', async () => {
    mockList.data = [item({ email: 'me@example.com' })];
    await render(<FeedbackScreen />);
    expect(screen.getByText('What you’ve sent')).toBeOnTheScreen();
    expect(screen.getByText('The + on Lunch added to Dinner')).toBeOnTheScreen();
    expect(screen.queryByText('me@example.com')).toBeNull();
  });

  it('shows a reader everyone’s feedback with who sent it and on what', async () => {
    mockReader.data = true;
    mockList.data = [item({}), item({ id: 'f2', email: 'me@example.com', kind: 'idea', message: 'Dark charts', device: null, screen: null })];
    await render(<FeedbackScreen />);
    expect(screen.getByText("Everyone's feedback · 2")).toBeOnTheScreen();
    expect(screen.getByText('friend@example.com')).toBeOnTheScreen();
    expect(screen.getByText('1.0.0 · Android 14 · Google Pixel 7 · from dashboard')).toBeOnTheScreen();
    expect(screen.getByText('Dark charts')).toBeOnTheScreen();
  });
});
