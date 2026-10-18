import { beforeEach, expect, jest, test } from '@jest/globals';
import * as FileSystem from 'expo-file-system/legacy';
import { loadSnapshot, persistSnapshot } from './offline';
import { downloadRegion, loadSavedTileRegion } from './tiles';
import { fetchWalkingRoute } from './routing';
import { checkOfflineReadiness, prepareOffline, type ReadinessInput } from './readiness';
import type { OfflineSnapshot, Place, Route, TileRegion } from '@/types';

jest.mock('expo-file-system/legacy', () => ({ getInfoAsync: jest.fn() }));
jest.mock('./offline', () => ({ loadSnapshot: jest.fn(), persistSnapshot: jest.fn() }));
jest.mock('./tiles', () => ({ TILE_DIR: 'file:///tiles', loadSavedTileRegion: jest.fn(), downloadRegion: jest.fn() }));
jest.mock('./routing', () => ({
 fetchWalkingRoute: jest.fn(),
 matchesDestination: (r: Route | null, p: Place) => !!r && r.targetId === p.id && r.to.latitude === p.coord.latitude && r.to.longitude === p.coord.longitude,
}));
const coord = { latitude: 47.65, longitude: -122.31 };
const place: Place = { id: 'meet', name: 'Meet', type: 'meeting', coord };
const route: Route = { targetId: 'meet', targetName: 'Meet', from: coord, to: coord, points: [coord, coord], distanceM: 0, durationS: 0, fetchedAt: Date.now(), isStraightLine: false };
const tiles: TileRegion = { center: coord, centers: [coord], radiusKm: .001, minZoom: 12, maxZoom: 12, tileCount: 1, downloadedAt: Date.now(), pathTemplate: 'file:///tiles/source/{z}/{x}/{y}.png', attribution: 'Credits' };
const input: ReadinessInput = { group: null, personalMeetingPlace: place, myLocation: coord, myUid: 'me', myName: 'Me', members: [], route, tiles };
const snapshot = (): OfflineSnapshot => ({ ...input, version: 1, savedAt: Date.now() });
beforeEach(() => {
 jest.clearAllMocks();
 jest.mocked(loadSnapshot).mockResolvedValue(snapshot());
 jest.mocked(loadSavedTileRegion).mockResolvedValue(tiles);
 jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: true, size: 100, isDirectory: false, uri: 'file:///tile', modificationTime: 1 });
 jest.mocked(fetchWalkingRoute).mockResolvedValue(route);
 jest.mocked(downloadRegion).mockResolvedValue(tiles);
 jest.mocked(persistSnapshot).mockResolvedValue();
});
test('complete saved personal plan is ready without requiring a group', async () => {
 const result = await checkOfflineReadiness(input);
 expect(result.ready).toBe(true);
 expect(result.checks.find(c => c.id === 'members')?.required).toBe(false);
});
test('Apple Maps cache is explicitly unverified independently of app-data readiness', async () => {
 jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({ exists: false, isDirectory: false, uri: 'file:///tile' });
 const result = await checkOfflineReadiness(input);
 expect(result.ready).toBe(true);
 expect(result.checks.find(c => c.id === 'map')).toMatchObject({ ready: false, required: false });
});
test('a changed destination with reused ID invalidates the saved plan', async () => {
 expect((await checkOfflineReadiness({ ...input, personalMeetingPlace: { ...place, coord: { ...coord, latitude: 47.67 } } })).ready).toBe(false);
});
test('straight-line routes do not count as saved walking directions', async () => {
 jest.mocked(loadSnapshot).mockResolvedValue({ ...snapshot(), route: { ...route, isStraightLine: true } });
 expect((await checkOfflineReadiness(input)).ready).toBe(false);
});
test('missing or stale group locations prevent a ready badge', async () => {
 const group = { id: 'group', name: 'Family', inviteCode: '123456', memberIds: ['me', 'friend'], meetingPlace: place, safeAreas: [] };
 jest.mocked(loadSnapshot).mockResolvedValue({ ...snapshot(), group });
 expect((await checkOfflineReadiness({ ...input, group })).ready).toBe(false);
 jest.mocked(loadSnapshot).mockResolvedValue({ ...snapshot(), group, members: [{ uid: 'friend', name: 'Friend', location: coord, locationTs: Date.now() - 16 * 60000, status: 'safe' }] });
 expect((await checkOfflineReadiness({ ...input, group })).ready).toBe(false);
});
test('offline preparation never fetches or downloads', async () => {
 await expect(prepareOffline(() => input, () => false, () => {}, () => {})).rejects.toThrow('Connect');
 expect(fetchWalkingRoute).not.toHaveBeenCalled();
 expect(downloadRegion).not.toHaveBeenCalled();
});
test('preparation writes route, tiles and member snapshot before applying state', async () => {
 const apply = jest.fn();
 await prepareOffline(() => input, () => true, () => {}, apply);
 expect(downloadRegion).not.toHaveBeenCalled();
 expect(persistSnapshot).toHaveBeenCalledWith(expect.objectContaining({ route, tiles, personalMeetingPlace: place }));
 expect(apply).toHaveBeenCalledWith(route, tiles);
});
test('storage failures are surfaced rather than marking the phone ready', async () => {
 const apply = jest.fn();
 jest.mocked(persistSnapshot).mockRejectedValue(new Error('Storage full'));
 await expect(prepareOffline(() => input, () => true, () => {}, apply)).rejects.toThrow('Storage full');
 expect(apply).not.toHaveBeenCalled();
});
test('destination changed during request cannot publish an old plan', async () => {
 const current = jest.fn<() => ReadinessInput>();
 current.mockReturnValueOnce(input).mockReturnValue({ ...input, personalMeetingPlace: { ...place, coord: { ...coord, latitude: 47.67 } } });
 await expect(prepareOffline(current, () => true, () => {}, () => {})).rejects.toThrow('changed');
 expect(downloadRegion).not.toHaveBeenCalled();
 expect(persistSnapshot).not.toHaveBeenCalled();
});

test('an in-memory route without a saved route never passes the route check', async () => {
 jest.mocked(loadSnapshot).mockResolvedValue({ ...snapshot(), route: null });
 const result = await checkOfflineReadiness(input);
 expect(result.checks.find(c => c.id === 'route')?.ready).toBe(false);
 expect(result.ready).toBe(false);
});
test('missing saved snapshot cannot count the currently displayed route as offline', async () => {
 jest.mocked(loadSnapshot).mockResolvedValue(null);
 expect((await checkOfflineReadiness(input)).checks.find(c => c.id === 'route')?.ready).toBe(false);
});
test('saved route explains automatic saving and keeps map availability separate', async () => {
 jest.mocked(loadSavedTileRegion).mockResolvedValue(null);
 const result = await checkOfflineReadiness(input);
 expect(result.checks.find(c => c.id === 'route')).toMatchObject({ ready: true, detail: expect.stringContaining('Automatically saved') });
 expect(result.checks.find(c => c.id === 'map')).toMatchObject({ ready: false, required: false });
 expect(result.ready).toBe(true);
});
