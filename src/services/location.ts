// [OWNER: SYNC] Device location. Battery rule: GPS only while the app is open,
// background updates only in "emergency mode" (needs EAS dev build on iOS).
import * as Location from 'expo-location';
import { distanceM } from '@/lib/geo';
import type { LatLng } from '@/types';

export const PUBLISH_MIN_DISTANCE_M = 100;
export const PUBLISH_MAX_INTERVAL_MS = 5 * 60_000;

export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function startForegroundWatch(onUpdate: (c: LatLng) => void): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 10_000 },
    (pos) => onUpdate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
  );
  return () => sub.remove();
}

/** Heading in degrees (0 = true/magnetic north). Works fully offline. */
export async function startHeadingWatch(onHeading: (deg: number) => void): Promise<() => void> {
  const sub = await Location.watchHeadingAsync((h) => onHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
  return () => sub.remove();
}

/** Throttle for Firestore writes: publish if moved >100 m or 5 min passed. */
export function shouldPublish(
  last: { coord: LatLng; ts: number } | null,
  next: LatLng,
  now: number = Date.now(),
): boolean {
  if (!last) return true;
  return distanceM(last.coord, next) >= PUBLISH_MIN_DISTANCE_M || now - last.ts >= PUBLISH_MAX_INTERVAL_MS;
}

// TODO [SYNC]: Emergency-mode background tracking (requires dev build, not Expo Go):
//   1. TaskManager.defineTask(BG_TASK, ({ data }) => publish data.locations[0]) at module top level
//   2. Location.requestBackgroundPermissionsAsync()
//   3. Location.startLocationUpdatesAsync(BG_TASK, { accuracy: Balanced, deferredUpdatesDistance: 100,
//        pausesUpdatesAutomatically: true, showsBackgroundLocationIndicator: true })
