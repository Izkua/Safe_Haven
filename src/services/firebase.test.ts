// Offline behaviour of the SYNC services. Firestore is mocked: `hang` stands in for "no signal"
// (a promise that never settles), which is what real Firestore calls do while offline.
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-key';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';

const mockSetDoc = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockUpdateDoc = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const mockGetDocs = jest.fn<(...a: unknown[]) => Promise<unknown>>();

jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {} }));
jest.mock('firebase/app', () => ({ getApps: () => [], initializeApp: () => ({}) }));
jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: { uid: 'u1' } }),
  getReactNativePersistence: () => ({}),
  initializeAuth: () => ({ currentUser: { uid: 'u1' } }),
  signInAnonymously: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  arrayRemove: (...a: unknown[]) => ({ arrayRemove: a }),
  arrayUnion: (...a: unknown[]) => ({ arrayUnion: a }),
  collection: (_db: unknown, path: string) => ({ path }),
  doc: (a: unknown, ...rest: unknown[]) => ({ id: 'new-id', path: rest.join('/'), a }),
  documentId: () => '__name__',
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
  getFirestore: () => ({}),
  initializeFirestore: () => ({}),
  limit: (n: number) => ({ limit: n }),
  onSnapshot: jest.fn(),
  query: (...a: unknown[]) => ({ query: a }),
  setDoc: (...a: unknown[]) => mockSetDoc(...a),
  updateDoc: (...a: unknown[]) => mockUpdateDoc(...a),
  where: (...a: unknown[]) => ({ where: a }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fb = require('./firebase') as typeof import('./firebase');

const hang = () => new Promise<never>(() => {});
const place = { id: 'meet', name: 'Meet', coord: { latitude: 1, longitude: 2 }, type: 'meeting' as const };

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  mockSetDoc.mockReset();
  mockUpdateDoc.mockReset();
  mockGetDocs.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('offline-safe writes', () => {
  test('publish/meeting/safe-area writes return even if the server never acknowledges', async () => {
    mockSetDoc.mockImplementation(hang);
    mockUpdateDoc.mockImplementation(hang);
    await expect(fb.publishStatus('u1', 'safe')).resolves.toBeUndefined();
    await expect(fb.publishLocation('u1', { latitude: 1, longitude: 2 })).resolves.toBeUndefined();
    await expect(fb.setMeetingPlace('g1', place)).resolves.toBeUndefined();
    await expect(fb.addSafeArea('g1', place)).resolves.toBeUndefined();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  test('a rejected write is logged, not thrown', async () => {
    mockUpdateDoc.mockRejectedValue(new Error('permission-denied'));
    await expect(fb.setMeetingPlace('g1', place)).resolves.toBeUndefined();
    await jest.advanceTimersByTimeAsync(0);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('groups', () => {
  test('createGroup returns a group with a 6-char code and the creator as member', async () => {
    mockGetDocs.mockResolvedValue({ empty: true, docs: [] });
    mockSetDoc.mockResolvedValue(undefined);
    const g = await fb.createGroup('u1', 'Family');
    expect(g).not.toBeNull();
    expect(g!.memberIds).toEqual(['u1']);
    expect(g!.inviteCode).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ2-9]{6}$/);
    expect(g!.meetingPlace).toBeNull();
  });

  test('createGroup and joinGroup return null instead of hanging with no signal', async () => {
    mockGetDocs.mockImplementation(hang);
    mockSetDoc.mockImplementation(hang);
    const created = fb.createGroup('u1', 'Family');
    const joined = fb.joinGroup('u1', 'ABC123');
    await jest.advanceTimersByTimeAsync(60_000);
    await expect(created).resolves.toBeNull();
    await expect(joined).resolves.toBeNull();
  });

  test('joinGroup: unknown code -> null; known code -> group including me', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await expect(fb.joinGroup('u2', 'NOPE12')).resolves.toBeNull();

    const data = { name: 'Family', inviteCode: 'ABC234', memberIds: ['u1'], meetingPlace: null, safeAreas: [] };
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'g1', ref: { path: 'groups/g1' }, data: () => data }] });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockSetDoc.mockResolvedValue(undefined);
    const g = await fb.joinGroup('u2', ' abc234 ');
    expect(g?.id).toBe('g1');
    expect(g?.memberIds).toEqual(['u1', 'u2']);
  });

  test('findMyGroup maps the first match, and is null when none / offline', async () => {
    const data = { name: 'Roommates', inviteCode: 'ZZZ999', memberIds: ['u1'] };
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'g9', data: () => data }] });
    const g = await fb.findMyGroup('u1');
    expect(g).toMatchObject({ id: 'g9', name: 'Roommates', meetingPlace: null, safeAreas: [] });

    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    await expect(fb.findMyGroup('u1')).resolves.toBeNull();

    mockGetDocs.mockImplementation(hang);
    const offline = fb.findMyGroup('u1');
    await jest.advanceTimersByTimeAsync(60_000);
    await expect(offline).resolves.toBeNull();
  });

  test('findMyGroups returns every group, and [] when offline', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'g1', data: () => ({ name: 'Family', memberIds: ['u1'] }) },
        { id: 'g2', data: () => ({ name: 'Roommates', memberIds: ['u1', 'u3'] }) },
      ],
    });
    const gs = await fb.findMyGroups('u1');
    expect(gs.map((g) => g.id)).toEqual(['g1', 'g2']);

    mockGetDocs.mockImplementation(hang);
    const offline = fb.findMyGroups('u1');
    await jest.advanceTimersByTimeAsync(60_000);
    await expect(offline).resolves.toEqual([]);
  });

  test('leaveGroup removes me from the group and my profile, without awaiting the server', async () => {
    mockUpdateDoc.mockImplementation(hang);
    mockSetDoc.mockImplementation(hang);
    await fb.leaveGroup('u1', 'g1');
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'groups/g1' }), { memberIds: { arrayRemove: ['u1'] } });
    expect(mockSetDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1' }), { groupIds: { arrayRemove: ['g1'] } }, { merge: true });
  });
});


describe('disaster havens', () => {
  test('saving changes only the selected disaster in the selected group', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await expect(fb.saveDisasterHaven('g2', 'flood', place)).resolves.toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'groups/g2' }), { 'disasterHavens.flood': place });
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });
  test('adoption changes only the active meeting point of the chosen group', async () => {
    mockUpdateDoc.mockResolvedValue(undefined);
    await expect(fb.adoptDisasterHaven('g2', place)).resolves.toBe(true);
    expect(mockUpdateDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'groups/g2' }), { meetingPlace: place });
  });
  test('a denied or unacknowledged save is not reported as successful', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(fb.saveDisasterHaven('g1', 'flood', place)).resolves.toBe(false);
    mockUpdateDoc.mockImplementation(hang);
    const save = fb.saveDisasterHaven('g1', 'earthquake', place);
    const adopt = fb.adoptDisasterHaven('g1', place);
    await jest.advanceTimersByTimeAsync(8001);
    await expect(save).resolves.toBe(false);
    await expect(adopt).resolves.toBe(false);
  });
  test('group loading restores disaster havens from Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [{ id: 'g1', data: () => ({ name: 'Family', memberIds: ['u1'], disasterHavens: { earthquake: place } }) }] });
    const groups = await fb.findMyGroups('u1');
    expect(groups[0].disasterHavens?.earthquake).toEqual(place);
  });
});
