import { beforeEach, expect, jest, test } from '@jest/globals';
import NetInfo from '@react-native-community/netinfo';
import { canChangeMeetingPlace } from './connectivity';
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: jest.fn() } }));
const fetchState = NetInfo.fetch as jest.Mock;
beforeEach(() => { fetchState.mockReset(); });
test('offline blocks editing without a network request', async () => {
 expect(await canChangeMeetingPlace(false)).toBe(false);
 expect(fetchState).not.toHaveBeenCalled();
});
test('only confirmed internet access permits editing', async () => {
 for (const state of [{ isConnected: false, isInternetReachable: false }, { isConnected: true, isInternetReachable: null }, { isConnected: true, isInternetReachable: false }]) {
  fetchState.mockResolvedValueOnce(state as never);
  expect(await canChangeMeetingPlace(true)).toBe(false);
 }
 fetchState.mockResolvedValueOnce({ isConnected: true, isInternetReachable: true } as never);
 expect(await canChangeMeetingPlace(true)).toBe(true);
});
test('reachability errors block changes', async () => {
 fetchState.mockRejectedValueOnce(new Error('offline') as never);
 expect(await canChangeMeetingPlace(true)).toBe(false);
});
