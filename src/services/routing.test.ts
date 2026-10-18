import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { createRouteRequestGuard, fallbackRoute, fetchWalkingRoute, NoWalkingRouteError, straightLineRoute } from './routing';
import type { Place } from '@/types';

const from = { latitude: 47.65, longitude: -122.31 };
const target: Place = { id: 'meet', name: 'Fountain', type: 'meeting', coord: { latitude: 47.66, longitude: -122.30 } };
const originalFetch = global.fetch;
const fetchMock = jest.fn<typeof fetch>();
let clock = Date.now();
beforeEach(() => { jest.useFakeTimers(); clock += 100000; jest.setSystemTime(clock); global.fetch = fetchMock as unknown as typeof fetch; fetchMock.mockReset(); });
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
function respond(body: unknown, ok = true) {
  fetchMock.mockResolvedValue({ ok, json: async () => body } as Response);
}
const payload = { code: 'Ok', routes: [{ distance: 1200, duration: 900, geometry: { type: 'LineString', coordinates: [[-122.31, 47.65], [-122.30, 47.66]] } }] };

test('pedestrian request converts longitude/latitude and preserves route distance and time', async () => {
  respond(payload);
  const route = await fetchWalkingRoute(from, target);
  expect(fetchMock.mock.calls[0][0]).toContain('/routed-foot/');
  expect(route.points).toEqual([from, target.coord]);
  expect(route).toMatchObject({ distanceM: 1200, durationS: 900, isStraightLine: false });
});
test('unavailable, malformed and failed requests reject for caller fallback', async () => {
  respond({ code: 'NoRoute' });
  await expect(fetchWalkingRoute(from, target)).rejects.toBeInstanceOf(NoWalkingRouteError);
  jest.advanceTimersByTime(1100);
  respond({ ...payload, routes: [{ ...payload.routes[0], geometry: { type: 'LineString', coordinates: [[999, 47], [0, 0]] } }] });
  await expect(fetchWalkingRoute(from, target)).rejects.toThrow();
  jest.advanceTimersByTime(1100);
  fetchMock.mockRejectedValue(new Error('network'));
  await expect(fetchWalkingRoute(from, target)).rejects.toThrow('network');
});
test('matching saved route is reused, but moved meeting place with same ID is not', () => {
  const cached = { ...straightLineRoute(from, target), isStraightLine: false };
  expect(fallbackRoute(from, target, cached).isStraightLine).toBe(false);
  expect(fallbackRoute(from, { ...target, coord: from }, cached).isStraightLine).toBe(true);
  expect(fallbackRoute(from, { ...target, id: 'other' }, cached).isStraightLine).toBe(true);
  expect(fallbackRoute(from, target, null).isStraightLine).toBe(true);
});
test('older destination request cannot replace newer destination', () => {
  const begin = createRouteRequestGuard();
  const first = begin();
  const second = begin();
  expect(first()).toBe(false);
  expect(second()).toBe(true);
});
test('rapid taps do not exceed provider request limit', async () => {
  respond(payload);
  await fetchWalkingRoute(from, target);
  await expect(fetchWalkingRoute(from, target)).rejects.toThrow('wait');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
test('stalled request is aborted after twelve seconds', async () => {
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const result = expect(fetchWalkingRoute(from, target)).rejects.toThrow('aborted');
  await jest.advanceTimersByTimeAsync(12000);
  await result;
});
