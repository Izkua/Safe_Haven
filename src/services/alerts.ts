// [OWNER: ALERTS] Disaster feeds + local notifications.
import * as Notifications from 'expo-notifications';
import { distanceM, pointInPolygon } from '@/lib/geo';
import type { HazardAlert, LatLng } from '@/types';

export { makeSimulatedAlert } from '@/mocks/demo';

export const POLL_INTERVAL_MS = 5 * 60_000;
export const QUAKE_RADIUS_KM = 150;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function notifyAlert(alert: HazardAlert): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title: alert.title, body: alert.instruction ?? alert.description, data: { alertId: alert.id } },
    trigger: null,
  });
}

export function isUserAffected(alert: HazardAlert, me: LatLng): boolean {
  if (alert.areas.length) return alert.areas.some((ring) => pointInPolygon(me, ring));
  if (alert.center) return distanceM(me, alert.center) <= QUAKE_RADIUS_KM * 1000;
  return true;
}

/**
 * TODO [ALERTS]: GET https://api.weather.gov/alerts/active?point={lat},{lng}
 *   headers: { 'User-Agent': 'SafeHaven (DubHacks 2026, team-contact@example.com)', Accept: 'application/geo+json' }
 *   Map each feature → HazardAlert: properties.{id, event, description, instruction, severity, sent, expires};
 *   geometry may be null (zone-based) → areas: [].
 */
export async function fetchNwsAlerts(me: LatLng): Promise<HazardAlert[]> {
  void me;
  return [];
}

/**
 * TODO [ALERTS]: GET https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson
 *   Keep quakes within QUAKE_RADIUS_KM of `me`; geometry.coordinates = [lng, lat, depth];
 *   properties.{mag, place, time}. severity: mag>=6 extreme, >=5 severe, >=4 moderate, else minor.
 */
export async function fetchUsgsQuakes(me: LatLng): Promise<HazardAlert[]> {
  void me;
  return [];
}

/** Fetch all feeds, keep ones that affect the user. Never throws (offline-safe). */
export async function checkAlerts(me: LatLng): Promise<HazardAlert[]> {
  const results = await Promise.allSettled([fetchNwsAlerts(me), fetchUsgsQuakes(me)]);
  return results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((a) => isUserAffected(a, me));
}
