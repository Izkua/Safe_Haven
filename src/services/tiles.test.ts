import { beforeEach, expect, jest, test } from '@jest/globals';

const mockFiles = new Map<string, { size: number; text?: string }>();
let mockFail = false;
let mockActive = 0;
let mockPeak = 0;
const mockDownload = jest.fn(async (path: string) => {
  mockActive++; mockPeak = Math.max(mockPeak, mockActive);
  await Promise.resolve(); mockActive--;
  if (mockFail) return { status: 403, mimeType: 'application/json' };
  mockFiles.set(path, { size: 100 });
  return { status: 200, mimeType: 'image/png' };
});
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  makeDirectoryAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(async (path: string) => {
    const f = mockFiles.get(path);
    return f ? { exists: true, size: f.size } : { exists: false };
  }),
  getFreeDiskStorageAsync: jest.fn(async () => 1000000000),
  createDownloadResumable: jest.fn((_url: string, path: string) => ({
    downloadAsync: () => mockDownload(path), cancelAsync: jest.fn(async () => {}),
  })),
  deleteAsync: jest.fn(async (path: string) => { mockFiles.delete(path); }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const f = mockFiles.get(from);
    if (!f) throw new Error('missing file');
    mockFiles.set(to, f); mockFiles.delete(from);
  }),
  writeAsStringAsync: jest.fn(async (path: string, text: string) => { mockFiles.set(path, { size: text.length, text }); }),
  readAsStringAsync: jest.fn(async (path: string) => {
    const f = mockFiles.get(path); if (!f?.text) throw new Error('missing'); return f.text;
  }),
}));

process.env.EXPO_PUBLIC_TILE_URL_TEMPLATE = 'https://example.com/{z}/{x}/{y}.png';
process.env.EXPO_PUBLIC_TILE_ATTRIBUTION = 'Test map attribution';
process.env.EXPO_PUBLIC_TILE_ATTRIBUTION_URL = 'https://example.com/credits';
// Load after environment setup; the Expo bundler substitutes these at app startup.
const { downloadRegion, loadSavedTileRegion, planTiles, localTilePath } = require('./tiles') as typeof import('./tiles');
const center = { latitude: 47.65, longitude: -122.31 };
beforeEach(() => { mockFiles.clear(); mockFail = false; mockActive = 0; mockPeak = 0; mockDownload.mockClear(); });

test('planning combines both destinations without duplicate tiles', () => {
  expect(planTiles([center, center])).toEqual(planTiles([center]));
  const meeting = { latitude: 47.67, longitude: -122.29 };
  expect(planTiles([center, meeting]).length).toBeGreaterThan(planTiles([center]).length);
});
test('successful download reports progress, bounds concurrency and reuses files', async () => {
  const progress = jest.fn();
  const region = await downloadRegion(center, progress, center);
  expect(mockPeak).toBeLessThanOrEqual(4);
  expect(progress).toHaveBeenLastCalledWith(region.tileCount, region.tileCount);
  expect(region.centers).toEqual([center, center]);
  const count = mockDownload.mock.calls.length;
  await downloadRegion(center, progress, center);
  expect(mockDownload).toHaveBeenCalledTimes(count);
});
test('failed download does not publish a completed manifest and retry works', async () => {
  mockFail = true;
  await expect(downloadRegion(center, () => {})).rejects.toThrow('rejected');
  expect(await loadSavedTileRegion()).toBeNull();
  expect([...mockFiles.keys()].some((p) => p.endsWith('.part'))).toBe(false);
  mockFail = false;
  await expect(downloadRegion(center, () => {})).resolves.toHaveProperty('tileCount');
});
test('saved metadata restores after download independently of app snapshot', async () => {
  const saved = await downloadRegion(center, () => {});
  const folder = saved.pathTemplate!.split('/{z}')[0];
  mockFiles.set(folder, { size: 100 });
  expect(await loadSavedTileRegion()).toEqual(saved);
  mockFiles.delete(folder);
  expect(await loadSavedTileRegion()).toBeNull();
});
test('invalid coordinates are rejected', () => {
  expect(() => planTiles([{ latitude: NaN, longitude: 0 }])).toThrow();
});

test('native tile path strips file URI prefix', () => {
 expect(localTilePath({ center, radiusKm: 1, minZoom: 12, maxZoom: 16, tileCount: 1, downloadedAt: 1, pathTemplate: 'file:///documents/{z}/{x}/{y}.png' })).toBe('/documents/{z}/{x}/{y}.png');
});
