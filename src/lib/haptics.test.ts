import { afterEach, expect, jest, test } from '@jest/globals';
import * as Haptics from 'expo-haptics';
import { buzzForAlert } from './haptics';
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Heavy: 'heavy', Light: 'light' },
  impactAsync: jest.fn(async () => {}), selectionAsync: jest.fn(async () => {}),
}));
afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); });
test('an emergency pulses briefly once and stays quiet when its page is reopened', () => {
  jest.useFakeTimers();
  const stop = buzzForAlert('emergency-reopen', 'emergency');
  jest.advanceTimersByTime(5000);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
  stop();
  buzzForAlert('emergency-reopen', 'emergency');
  jest.advanceTimersByTime(10000);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(3);
  buzzForAlert('new-disaster', 'emergency');
  jest.advanceTimersByTime(400);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(6);
});
test('leaving the warning cancels every pending pulse, including within a burst', () => {
  jest.useFakeTimers();
  const stop = buzzForAlert('cancel-burst', 'emergency');
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
  stop();
  jest.advanceTimersByTime(5000);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});
test('a severity change does not restart attention for the same warning', () => {
  jest.useFakeTimers();
  buzzForAlert('severity-update', 'watch');
  buzzForAlert('severity-update', 'emergency');
  jest.advanceTimersByTime(5000);
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
});
