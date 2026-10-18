// Offline raster XYZ tiles. Configure a source licensed for offline downloads.
import * as FileSystem from 'expo-file-system/legacy';
import { tilesForRegion } from '@/lib/geo';
import type { LatLng, TileRegion } from '@/types';

export const TILE_DIR = `${FileSystem.documentDirectory}tiles`;
export const TILE_PATH_TEMPLATE = `${TILE_DIR}/{z}/{x}/{y}.png`;
export function localTilePath(region: TileRegion): string {
  return decodeURI(region.pathTemplate ?? TILE_PATH_TEMPLATE).replace(/^file:\/\//, '');
}
const MANIFEST = `${TILE_DIR}/saved-region.json`;
const URL_TEMPLATE = process.env.EXPO_PUBLIC_TILE_URL_TEMPLATE ?? '';
const ATTRIBUTION = process.env.EXPO_PUBLIC_TILE_ATTRIBUTION ?? '';
export const ONLINE_TILE_URL = URL_TEMPLATE && !URL_TEMPLATE.includes('YOUR_KEY') ? URL_TEMPLATE : '';
export const TILE_ATTRIBUTION = ATTRIBUTION;
const ATTRIBUTION_URL = process.env.EXPO_PUBLIC_TILE_ATTRIBUTION_URL ?? '';
export const DEFAULT_REGION = { radiusKm: 1.5, minZoom: 12, maxZoom: 16 };
const MAX_TILES = 2500;
const MAX_BYTES = 90 * 1024 * 1024;
let busy = false;

export function tileConfigurationError(): string | null {
  if (!URL_TEMPLATE) return 'Offline maps need a configured tile source. Ask your team to add one.';
  try {
    const url = new URL(URL_TEMPLATE);
    if (url.protocol !== 'https:' || !['{z}', '{x}', '{y}'].every((key) => URL_TEMPLATE.includes(key)) || URL_TEMPLATE.includes('YOUR_KEY')) return 'The offline tile source is incomplete.';
    if (/(^|\.)tile\.openstreetmap\.org$/i.test(url.hostname)) return 'This OpenStreetMap server does not permit offline downloads.';
    if (!ATTRIBUTION || new URL(ATTRIBUTION_URL).protocol !== 'https:') return 'The tile source needs its attribution text and HTTPS attribution link.';
  } catch { return 'The offline tile source or attribution link is invalid.'; }
  return null;
}

export function planTiles(centers: LatLng[], radiusKm = DEFAULT_REGION.radiusKm) {
  if (!centers.length || centers.some((c) => !Number.isFinite(c.latitude) || Math.abs(c.latitude) > 80 || !Number.isFinite(c.longitude) || Math.abs(c.longitude) > 179)) throw new Error('Choose a valid map area first.');
  const tiles = new Map<string, { z: number; x: number; y: number }>();
  for (const center of centers) {
    for (const tile of tilesForRegion(center, radiusKm, DEFAULT_REGION.minZoom, DEFAULT_REGION.maxZoom)) tiles.set(`${tile.z}/${tile.x}/${tile.y}`, tile);
  }
  if (tiles.size > MAX_TILES) throw new Error('This area is too large. Choose a closer meeting place.');
  return [...tiles.values()];
}

export function estimateTileCount(center: LatLng, radiusKm = DEFAULT_REGION.radiusKm): number {
  return planTiles([center], radiusKm).length;
}

export async function loadSavedTileRegion(): Promise<TileRegion | null> {
  try {
    const region = JSON.parse(await FileSystem.readAsStringAsync(MANIFEST)) as TileRegion;
    if (!region.pathTemplate || !region.centers?.length || !region.downloadedAt || !region.attribution) return null;
    const folder = region.pathTemplate.slice(0, region.pathTemplate.indexOf('/{z}'));
    return (await FileSystem.getInfoAsync(folder)).exists ? region : null;
  } catch { return null; }
}

/** Single call covers both locations; reused tiles are not downloaded again. */
export async function downloadRegion(
  center: LatLng,
  onProgress: (done: number, total: number) => void,
  meetingPlace?: LatLng,
): Promise<TileRegion> {
  const error = tileConfigurationError();
  if (error) throw new Error(error);
  if (busy) throw new Error('A map download is already running.');
  busy = true;
  const centers = meetingPlace ? [center, meetingPlace] : [center];
  // Namespace by the full source so changing styles/providers never mixes tiles.
  let hash = 2166136261;
  for (let i = 0; i < URL_TEMPLATE.length; i++) hash = Math.imul(hash ^ URL_TEMPLATE.charCodeAt(i), 16777619);
  const dir = `${TILE_DIR}/source-${(hash >>> 0).toString(16)}`;
  let failure: Error | null = null;
  try {
    const tiles = planTiles(centers);
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const disk = await FileSystem.getInfoAsync(TILE_DIR);
    let bytes = disk.exists ? disk.size : 0;
    if (bytes >= MAX_BYTES) throw new Error('Offline map storage is full (90 MB limit).');
    const free = await FileSystem.getFreeDiskStorageAsync();
    if (free < tiles.length * 50000 + 10 * 1024 * 1024) throw new Error('Not enough free space to save this map.');
    let cursor = 0;
    let done = 0;
    onProgress(0, tiles.length);
    const worker = async () => {
      while (!failure && cursor < tiles.length) {
        const { z, x, y } = tiles[cursor++];
        const folder = `${dir}/${z}/${x}`;
        const path = `${folder}/${y}.png`;
        let temporary: string | null = null;
        try {
          const info = await FileSystem.getInfoAsync(path);
          if (!info.exists || info.size === 0) {
            await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
            temporary = `${path}.part`;
            const url = URL_TEMPLATE.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
            const task = FileSystem.createDownloadResumable(url, temporary);
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const result = await Promise.race([
                task.downloadAsync(),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => {
                    void task.cancelAsync().catch(() => {});
                    reject(new Error('Map download timed out. Please retry.'));
                  }, 20000);
                }),
              ]);
              if (!result || result.status !== 200 || !result.mimeType?.toLowerCase().startsWith('image/')) throw new Error('Tile source rejected the download. Check your key and plan.');
            } finally { if (timer) clearTimeout(timer); }
            const saved = await FileSystem.getInfoAsync(temporary);
            if (!saved.exists || saved.size === 0 || saved.size > 1024 * 1024) throw new Error('The tile source returned an invalid or oversized image.');
            bytes += saved.size;
            if (bytes > MAX_BYTES) throw new Error('Offline map storage reached the 90 MB limit.');
            await FileSystem.moveAsync({ from: temporary, to: path });
            temporary = null;
          }
          onProgress(++done, tiles.length);
        } catch (e) {
          failure = e instanceof Error ? e : new Error('Map download failed. Please retry.');
        } finally {
          if (temporary) await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {});
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, tiles.length) }, worker));
    if (failure) throw failure;
    const region: TileRegion = {
      center, centers, ...DEFAULT_REGION, tileCount: tiles.length, downloadedAt: Date.now(),
      pathTemplate: `${dir}/{z}/{x}/{y}.png`, attribution: ATTRIBUTION, attributionUrl: ATTRIBUTION_URL,
    };
    // Publish metadata only after every tile succeeds. Partial downloads can be resumed.
    await FileSystem.writeAsStringAsync(`${MANIFEST}.part`, JSON.stringify(region));
    await FileSystem.moveAsync({ from: `${MANIFEST}.part`, to: MANIFEST });
    return region;
  } finally { busy = false; }
}
