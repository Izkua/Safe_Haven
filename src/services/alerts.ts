// [OWNER: ALERTS] Disaster feeds + local notifications.
import type * as NotificationsModule from 'expo-notifications';
import { distanceM, pointInPolygon } from '@/lib/geo';
import type { HazardAlert, LatLng } from '@/types';

export { makeSimulatedAlert } from '@/mocks/demo';

export const POLL_INTERVAL_MS = 5 * 60_000;
export const QUAKE_RADIUS_KM = 150;

// Loaded defensively: Expo Go on Android lacks some expo-notifications native modules
// (ExpoTopicSubscriptionModule) and a top-level import crashes the whole app. Without it,
// alerts still open the in-app alert screen; only the system notification is skipped.
let Notifications: typeof NotificationsModule | null = null;
try {
  Notifications = require('expo-notifications') as typeof NotificationsModule;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  Notifications = null;
  console.warn('Notifications unavailable on this build; alerts will show in-app only.', e);
}

export const notificationsAvailable = () => Notifications !== null;

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) return false;
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

export async function notifyAlert(alert: HazardAlert): Promise<void> {
  if (!Notifications) return;
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
