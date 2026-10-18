import { beforeEach, expect, jest, test } from '@jest/globals';
import { tilesForRegion } from '@/lib/geo';
import type { TileRegion } from '@/types';

const mockFiles = new Map<string, { size: number; text?: string }>();
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  getInfoAsync: jest.fn(async (path: string) => {
    const f = mockFiles.get(path);
    return f ? { exists: true, size: f.size, isDirectory: false } : { exists: false };
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const f = mockFiles.get(from);
    if (!f) throw new Error('missing file');
    mockFiles.set(to, f); mockFiles.delete(from);
  }),
  readAsStringAsync: jest.fn(async (path: string) => {
    const f = mockFiles.get(path); if (!f?.text) throw new Error('missing'); return f.text;
  }),
}));

const { loadSavedTileRegion } = require('./tiles') as typeof import('./tiles');
const MANIFEST = 'file:///documents/tiles/saved-region.json';
const center = { latitude: 47.65, longitude: -122.31 };
const saved: TileRegion = {
  center, centers: [center], radiusKm: 0.3, minZoom: 15, maxZoom: 15, tileCount: 0, downloadedAt: 1,
  pathTemplate: 'file:///documents/tiles/source-abc/{z}/{x}/{y}', cacheFormat: 'native-v1', attribution: 'Test map',
};
const tilePaths = (template: string) =>
  tilesForRegion(center, saved.radiusKm, saved.minZoom, saved.maxZoom).map(({ z, x, y }) =>
    template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
const saveManifest = (region: TileRegion) => mockFiles.set(MANIFEST, { size: 1, text: JSON.stringify(region) });
beforeEach(() => mockFiles.clear());

test('no saved map loads as null', async () => {
  expect(await loadSavedTileRegion()).toBeNull();
});
test('a complete saved map restores; a missing tile makes it null', async () => {
  const paths = tilePaths(saved.pathTemplate!);
  paths.forEach((p) => mockFiles.set(p, { size: 100 }));
  saveManifest(saved);
  expect(await loadSavedTileRegion()).toMatchObject({ pathTemplate: saved.pathTemplate, cacheFormat: 'native-v1', tileCount: paths.length });
  mockFiles.delete(paths[0]);
  expect(await loadSavedTileRegion()).toBeNull();
});
test('legacy PNG files migrate to the extensionless native cache', async () => {
  const paths = tilePaths(saved.pathTemplate!);
  paths.forEach((p) => mockFiles.set(`${p}.png`, { size: 100 }));
  saveManifest({ ...saved, pathTemplate: `${saved.pathTemplate}.png` });
  expect(await loadSavedTileRegion()).toMatchObject({ pathTemplate: saved.pathTemplate, cacheFormat: 'native-v1' });
  expect([...mockFiles.keys()].some((p) => p.endsWith('.png'))).toBe(false);
});
test('old sandbox absolute paths resolve under the current document directory', async () => {
  tilePaths(saved.pathTemplate!).forEach((p) => mockFiles.set(p, { size: 100 }));
  saveManifest({ ...saved, pathTemplate: saved.pathTemplate!.replace('file:///documents', 'file:///old-app-container/Documents') });
  expect((await loadSavedTileRegion())?.pathTemplate).toBe(saved.pathTemplate);
});
