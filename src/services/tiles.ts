// [OWNER: MAP/OFFLINE] Download map tiles for a small area so the map renders with no network.
// Rendered on the map via <LocalTile pathTemplate={TILE_PATH_TEMPLATE} />.
import * as FileSystem from 'expo-file-system/legacy';
import { tilesForRegion } from '@/lib/geo';
import type { LatLng, TileRegion } from '@/types';

export const TILE_DIR = `${FileSystem.documentDirectory}tiles`;
export const TILE_PATH_TEMPLATE = `${TILE_DIR}/{z}/{x}/{y}.png`;
const URL_TEMPLATE = process.env.EXPO_PUBLIC_TILE_URL_TEMPLATE ?? '';

/** Tile URL for live (online) base-map tiles, or '' if no real key is configured. */
export const ONLINE_TILE_URL = URL_TEMPLATE && !URL_TEMPLATE.includes('YOUR_KEY') ? URL_TEMPLATE : '';
export const TILE_ATTRIBUTION = '© MapTiler © OpenStreetMap contributors';

export const DEFAULT_REGION = { radiusKm: 3, minZoom: 12, maxZoom: 16 };

export function estimateTileCount(center: LatLng, radiusKm = DEFAULT_REGION.radiusKm): number {
  return tilesForRegion(center, radiusKm, DEFAULT_REGION.minZoom, DEFAULT_REGION.maxZoom).length;
}

/**
 * TODO [MAP]: download every tile from tilesForRegion(...) to TILE_DIR/{z}/{x}/{y}.png.
 *   - FileSystem.makeDirectoryAsync(dir, { intermediates: true }) per z/x
 *   - FileSystem.downloadAsync(url, path), ~6 in parallel, skip ones that already exist
 *   - call onProgress(done, total); return the TileRegion for the snapshot
 *   Use a provider that allows offline caching (MapTiler/Stadia). Never bulk-download tile.openstreetmap.org.
 */
export async function downloadRegion(
  center: LatLng,
  onProgress: (done: number, total: number) => void,
): Promise<TileRegion | null> {
  if (!URL_TEMPLATE) {
    console.warn('EXPO_PUBLIC_TILE_URL_TEMPLATE not set; skipping tile download');
    return null;
  }
  const tiles = tilesForRegion(center, DEFAULT_REGION.radiusKm, DEFAULT_REGION.minZoom, DEFAULT_REGION.maxZoom);
  onProgress(0, tiles.length);
  console.warn('TODO downloadRegion', tiles.length, 'tiles');
  return null;
}
