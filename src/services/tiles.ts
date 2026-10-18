// [OWNER: MAP/OFFLINE] Offline raster tiles saved by an earlier version's "Save map" download.
// The download itself was removed (the map now uses Apple Maps and Offline Readiness); this only
// restores a map someone already saved, so it keeps working offline.
import * as FileSystem from 'expo-file-system/legacy';
import { tilesForRegion } from '@/lib/geo';
import type { TileRegion } from '@/types';

export const TILE_DIR = `${FileSystem.documentDirectory}tiles`;
export const TILE_PATH_TEMPLATE = `${TILE_DIR}/{z}/{x}/{y}.png`;
const MANIFEST = `${TILE_DIR}/saved-region.json`;
const MAX_TILES = 2500;

/** Rebase old iOS sandbox paths and migrate legacy .png tiles to the native cache layout. */
export async function prepareOfflineTileCache(region: TileRegion): Promise<TileRegion> {
  const oldTemplate = region.pathTemplate ?? TILE_PATH_TEMPLATE;
  const suffix = oldTemplate.split('/tiles/')[1];
  if (!suffix || !/^(source-[0-9a-f]+\/)?\{z\}\/\{x\}\/\{y\}(\.png)?$/.test(suffix)) throw new Error('Saved-map path is invalid. Prepare the map again.');
  const template = `${TILE_DIR}/${suffix.replace(/\.png$/, '')}`;
  const centers = region.centers ?? [region.center];
  if (!centers.length || centers.length > 100 || region.radiusKm <= 0 || region.radiusKm > 3 ||
      !Number.isInteger(region.minZoom) || !Number.isInteger(region.maxZoom) || region.minZoom < 0 || region.maxZoom > 20 || region.maxZoom < region.minZoom) throw new Error('Saved-map coverage is invalid. Prepare the map again.');
  const expected = new Map<string, { z: number; x: number; y: number }>();
  for (const center of centers) {
    if (!Number.isFinite(center.latitude) || Math.abs(center.latitude) > 80 || !Number.isFinite(center.longitude) || Math.abs(center.longitude) > 179) throw new Error('Saved-map location is invalid.');
    for (const t of tilesForRegion(center, region.radiusKm, region.minZoom, region.maxZoom)) expected.set(`${t.z}/${t.x}/${t.y}`, t);
  }
  if (!expected.size || expected.size > MAX_TILES) throw new Error('Saved-map area is invalid.');
  const entries = [...expected.values()];
  for (let start = 0; start < entries.length; start += 16) {
    await Promise.all(entries.slice(start, start + 16).map(async ({ z, x, y }) => {
      const path = template.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists && !info.isDirectory && info.size > 0) return;
      const legacy = await FileSystem.getInfoAsync(`${path}.png`);
      if (!legacy.exists || legacy.isDirectory || legacy.size <= 0) throw new Error('Some map files are missing. Reconnect and prepare the map again.');
      await FileSystem.moveAsync({ from: `${path}.png`, to: path });
    }));
  }
  return { ...region, centers, pathTemplate: template, tileCount: expected.size, cacheFormat: 'native-v1' };
}

let loadingSavedRegion: Promise<TileRegion | null> | null = null;
export function loadSavedTileRegion(): Promise<TileRegion | null> {
  if (!loadingSavedRegion) {
    loadingSavedRegion = (async () => {
      try {
        const region = JSON.parse(await FileSystem.readAsStringAsync(MANIFEST)) as TileRegion;
        if (!region.pathTemplate || !region.downloadedAt || !region.attribution) return null;
        return await prepareOfflineTileCache(region);
      } catch { return null; }
    })().finally(() => { loadingSavedRegion = null; });
  }
  return loadingSavedRegion;
}
