import { beforeEach, expect, jest, test } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSnapshot, saveSnapshot } from './offline';
import type { OfflineSnapshot, Place } from '@/types';
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));
const getItem = jest.mocked(AsyncStorage.getItem);
const setItem = jest.mocked(AsyncStorage.setItem);
beforeEach(() => { getItem.mockReset(); setItem.mockReset(); setItem.mockResolvedValue(); });
const place: Place = { id: 'meet', name: 'My meeting place', type: 'meeting', coord: { latitude: 47.65, longitude: -122.31 } };
const snapshot: Omit<OfflineSnapshot, 'version' | 'savedAt'> = { myUid: null, myName: 'Me', group: null, members: [], route: null, tiles: null, personalMeetingPlace: place };
test('personal meeting place survives saving and loading without a group', async () => {
 await saveSnapshot(snapshot);
 const raw = setItem.mock.calls[0][1];
 getItem.mockResolvedValue(raw);
 expect(await loadSnapshot()).toMatchObject({ group: null, personalMeetingPlace: place });
});
test('older snapshots without a personal meeting place still load', async () => {
 const { personalMeetingPlace, ...old } = snapshot;
 getItem.mockResolvedValue(JSON.stringify({ ...old, version: 1, savedAt: 1 }));
 expect(await loadSnapshot()).toMatchObject({ group: null, version: 1 });
});

test('offline snapshots preserve separate disaster havens for every group', async () => {
  const groups = ['family', 'friends'].map((id, i) => ({ id, name: id, inviteCode: 'ABCDEF', memberIds: ['me'], meetingPlace: null, safeAreas: [],
    disasterHavens: { earthquake: { ...place, name: i === 0 ? 'Field' : 'Park' } } }));
  await saveSnapshot({ ...snapshot, group: groups[0], groups, activeGroupId: 'family' });
  getItem.mockResolvedValue(setItem.mock.calls[0][1]);
  const restored = await loadSnapshot();
  expect(restored?.groups?.map(g => g.disasterHavens?.earthquake?.name)).toEqual(['Field', 'Park']);
  expect(restored?.groups?.every(g => g.meetingPlace === null)).toBe(true);
});
