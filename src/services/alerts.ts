// [OWNER: ALERTS] Disaster feeds + local notifications.
import type * as NotificationsModule from 'expo-notifications';
import { distanceM, pointInPolygon } from '@/lib/geo';
import type { AlertSeverity, HazardAlert, HazardType, LatLng } from '@/types';

export { makeSimulatedAlert } from '@/mocks/demo';

export const POLL_INTERVAL_MS = 5 * 60_000;
export const QUAKE_RADIUS_KM = 150;
/** Smaller quakes are rarely felt at a distance; alerting on them would just cause alarm. */
export const QUAKE_MIN_MAGNITUDE = 4;
/** How long a quake alert stays relevant after it happens. */
const QUAKE_ALERT_TTL_MS = 60 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

const NWS_URL = 'https://api.weather.gov/alerts/active';
const USGS_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_hour.geojson';

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

// ---------------------------------------------------------------------------
// Live feeds. Fetchers never throw (offline-safe); parsers are pure so they can be tested on saved JSON.
// ---------------------------------------------------------------------------

async function getJson(url: string, headers?: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** National Weather Service alerts for the user's point (US only; elsewhere this returns nothing). */
export async function fetchNwsAlerts(me: LatLng): Promise<HazardAlert[]> {
  try {
    const point = `${me.latitude.toFixed(4)},${me.longitude.toFixed(4)}`;
    const json = await getJson(`${NWS_URL}?point=${point}&status=actual&message_type=alert,update`, {
      // NWS rejects requests without a User-Agent.
      'User-Agent': 'SafeHaven emergency app (DubHacks 2026)',
      Accept: 'application/geo+json',
    });
    return parseNwsAlerts(json);
  } catch (e) {
    console.warn('fetchNwsAlerts failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/** USGS earthquakes from the last hour, magnitude ≥ QUAKE_MIN_MAGNITUDE within QUAKE_RADIUS_KM. */
export async function fetchUsgsQuakes(me: LatLng): Promise<HazardAlert[]> {
  try {
    return parseUsgsQuakes(await getJson(USGS_URL), me);
  } catch (e) {
    console.warn('fetchUsgsQuakes failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

const NWS_SEVERITY: Record<string, AlertSeverity> = { Extreme: 'extreme', Severe: 'severe', Moderate: 'moderate', Minor: 'minor' };

/** "Severe" on NWS's scale but about crops or boats, not people on land: don't open an emergency alert. */
const NWS_IGNORED_EVENT = /freeze|frost|freezing spray|marine|gale|small craft|hazardous seas|hurricane force wind|^storm (watch|warning)$/i;

/** NWS updates reference the alert they replace; remembered so an update to a seen alert doesn't pop up again. */
const supersedes = new WeakMap<HazardAlert, string[]>();

/**
 * NWS GeoJSON → alerts. Only Severe/Extreme ones: the feed is mostly advisories (small craft, frost)
 * that shouldn't open a full-screen emergency alert.
 */
export function parseNwsAlerts(json: any, now: number = Date.now()): HazardAlert[] {
  const out: HazardAlert[] = [];
  for (const f of json?.features ?? []) {
    const p = f?.properties;
    if (!p?.id || !p.event) continue;
    if (p.status && p.status !== 'Actual') continue;
    if (p.messageType === 'Cancel') continue;
    if (NWS_IGNORED_EVENT.test(p.event)) continue;
    const severity = NWS_SEVERITY[p.severity] ?? 'unknown';
    if (severity !== 'extreme' && severity !== 'severe') continue;
    const end = Date.parse(p.ends ?? p.expires ?? '');
    if (Number.isFinite(end) && end < now) continue;

    const alert: HazardAlert = {
      id: `nws:${p.id}`,
      source: 'nws',
      hazard: hazardFromNwsEvent(p.event),
      title: p.event,
      description: [p.headline, p.description].filter(Boolean).join('\n\n'),
      instruction: p.instruction ?? null,
      severity,
      areas: geometryRings(f.geometry), // null geometry = zone-based; NWS already filtered by our point
      center: null,
      issuedAt: Date.parse(p.sent ?? p.effective ?? '') || now,
      expiresAt: Number.isFinite(end) ? end : null,
    };
    const refs: string[] = (p.references ?? []).filter((r: any) => r?.identifier).map((r: any) => `nws:${r.identifier}`);
    if (refs.length) supersedes.set(alert, refs);
    out.push(alert);
  }
  return out;
}

/** Best-effort mapping from an NWS event name to the safety steps we have. Unknown → generic guidance. */
export function hazardFromNwsEvent(event: string): HazardType | undefined {
  const e = event.toLowerCase();
  if (e.includes('tsunami')) return 'tsunami';
  if (e.includes('earthquake')) return 'earthquake';
  if (e.includes('tornado')) return 'tornado';
  if (e.includes('hurricane') || e.includes('typhoon') || e.includes('tropical storm') || e.includes('storm surge')) return 'hurricane';
  // "Red Flag Warning" means fire *conditions*, not an active fire, so it gets generic guidance.
  if (e.includes('fire') && !e.includes('red flag')) return 'wildfire';
  if (e.includes('flood')) return 'flood';
  return undefined;
}

/** GeoJSON [lng, lat] polygons → outer rings as LatLng. */
function geometryRings(g: any): HazardAlert['areas'] {
  const flip = (ring: number[][]) => ring.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  if (g?.type === 'Polygon') return [flip(g.coordinates[0])];
  if (g?.type === 'MultiPolygon') return g.coordinates.map((poly: number[][][]) => flip(poly[0]));
  return [];
}

export function parseUsgsQuakes(json: any, me: LatLng, now: number = Date.now()): HazardAlert[] {
  const out: HazardAlert[] = [];
  for (const f of json?.features ?? []) {
    const p = f?.properties;
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    if (!f?.id || typeof p?.mag !== 'number' || typeof lat !== 'number' || typeof lng !== 'number') continue;
    if (p.mag < QUAKE_MIN_MAGNITUDE) continue;
    const center = { latitude: lat, longitude: lng };
    if (distanceM(me, center) > QUAKE_RADIUS_KM * 1000) continue;
    const issuedAt = typeof p.time === 'number' ? p.time : now;
    if (issuedAt + QUAKE_ALERT_TTL_MS < now) continue;

    const severity: AlertSeverity = p.mag >= 6 ? 'extreme' : p.mag >= 5 ? 'severe' : 'moderate';
    out.push({
      id: `usgs:${f.id}`,
      source: 'usgs',
      hazard: 'earthquake',
      title: `M${p.mag.toFixed(1)} earthquake`,
      description: `${p.place ?? 'Near you'}.${p.tsunami ? ' A tsunami is possible: check official warnings now.' : ''}`,
      instruction: null,
      severity,
      areas: [],
      center,
      issuedAt,
      expiresAt: issuedAt + QUAKE_ALERT_TTL_MS,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seen alerts: each real alert pops up once, so dismissing it doesn't bring it back on the next poll.
// ---------------------------------------------------------------------------

const SEEN_KEY = 'safehaven.seenAlerts.v1';
const SEEN_MAX = 200;
let seenIds: Set<string> | null = null;

// Required lazily so importing this module (e.g. for isUserAffected in tests) doesn't need native storage.
const storage = () =>
  (require('@react-native-async-storage/async-storage') as typeof import('@react-native-async-storage/async-storage')).default;

async function loadSeen(): Promise<Set<string>> {
  if (!seenIds) {
    try {
      seenIds = new Set<string>(JSON.parse((await storage().getItem(SEEN_KEY)) ?? '[]'));
    } catch {
      seenIds = new Set();
    }
  }
  return seenIds;
}

async function markSeen(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const seen = await loadSeen();
  ids.forEach((id) => seen.add(id));
  try {
    storage().setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_MAX))).catch(() => {});
  } catch {
    // No storage (tests / broken native module): seen list just lives in memory this session.
  }
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4 };

/**
 * Fetch all feeds, keep new ones that affect the user, most severe first. Never throws (offline-safe).
 * The caller shows the first result, so it's marked seen here; the rest come back on the next poll.
 */
export async function checkAlerts(me: LatLng): Promise<HazardAlert[]> {
  const results = await Promise.allSettled([fetchNwsAlerts(me), fetchUsgsQuakes(me)]);
  const affecting = results
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((a) => isUserAffected(a, me));

  const seen = await loadSeen();
  const isSeen = (a: HazardAlert) => seen.has(a.id) || (supersedes.get(a) ?? []).some((id) => seen.has(id));
  const fresh = affecting.filter((a) => !isSeen(a));
  fresh.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.issuedAt - a.issuedAt);

  // Updates to an alert already shown count as seen too, so the chain stays quiet.
  const updatesOfSeen = affecting.filter((a) => isSeen(a) && !seen.has(a.id)).map((a) => a.id);
  await markSeen([...updatesOfSeen, ...(fresh[0] ? [fresh[0].id] : [])]);
  return fresh;
}
