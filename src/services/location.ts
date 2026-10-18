// [OWNER: SYNC] Device location. Battery rule: GPS only while the app is open,
// background updates only in "emergency mode" (needs EAS dev build on iOS).
import * as Location from 'expo-location';
import { distanceM } from '@/lib/geo';
import { formatStreetAddress } from '@/lib/meeting';
import type { LatLng } from '@/types';

export const PUBLISH_MIN_DISTANCE_M = 20;
export const PUBLISH_MAX_INTERVAL_MS = 60_000;

export async function requestForegroundPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function startForegroundWatch(onUpdate: (c: LatLng) => void): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 10, timeInterval: 10_000 },
    (pos) => onUpdate({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
  );
  return () => sub.remove();
}

/** Heading in degrees (0 = true/magnetic north). Works fully offline. */
export async function startHeadingWatch(onHeading: (deg: number) => void): Promise<() => void> {
  const sub = await Location.watchHeadingAsync((h) => onHeading(h.trueHeading >= 0 ? h.trueHeading : h.magHeading));
  return () => sub.remove();
}

/** Throttle for Firestore writes: publish if moved >20 m or 1 min passed (tuned so the demo looks live). */
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

/**
 * Address → coordinates with the phone's built-in geocoder (Apple / Google, no API key).
 * Null if nothing matched, no signal, or it took too long.
 */
/**
 * [UI] Nearest street address for a spot (e.g. "4060 George Washington Ln NE, Seattle"), or null.
 * Uses the phone's built-in geocoder (Apple on iOS): no API key. Never throws.
 */
export async function reverseGeocode(coord: LatLng, timeoutMs = 8_000): Promise<string | null> {
  try {
    const results = await Promise.race([
      Location.reverseGeocodeAsync(coord),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('reverse geocode timed out')), timeoutMs)),
    ]);
    return formatStreetAddress(results[0]);
  } catch (e) {
    console.warn('reverseGeocode failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function geocodeAddress(address: string, timeoutMs = 10_000): Promise<LatLng | null> {
  const q = address.trim();
  if (!q) return null;
  try {
    const results = await Promise.race([
      Location.geocodeAsync(q),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('geocode timed out')), timeoutMs)),
    ]);
    const first = results[0];
    return first ? { latitude: first.latitude, longitude: first.longitude } : null;
  } catch (e) {
    console.warn('geocodeAddress failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
