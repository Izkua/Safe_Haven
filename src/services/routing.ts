// [OWNER: MAP/OFFLINE] Walking route fetched while online, cached for offline use.
import { distanceM } from '@/lib/geo';
import type { LatLng, Place, Route } from '@/types';

const WALK_SPEED_MPS = 1.3;

export function straightLineRoute(from: LatLng, to: Place): Route {
  const d = distanceM(from, to.coord);
  return {
    targetId: to.id,
    targetName: to.name,
    from,
    to: to.coord,
    points: [from, to.coord],
    distanceM: d,
    durationS: d / WALK_SPEED_MPS,
    fetchedAt: Date.now(),
    isStraightLine: true,
  };
}

/** FOSSGIS foot graph (the OSRM URL profile token does not select the graph).
 * Policy: https://routing.openstreetmap.de/about.html — at most 1 request/sec.
 * Suitable for a small demo; coordinates are sent to the provider and logged.
 */
let nextRequestAt = 0;

export function matchesDestination(route: Route | null, target: Place): boolean {
  return !!route && route.targetId === target.id &&
    route.to.latitude === target.coord.latitude && route.to.longitude === target.coord.longitude;
}

export function fallbackRoute(from: LatLng, target: Place, cached: Route | null): Route {
  return matchesDestination(cached, target) && !cached!.isStraightLine
    ? { ...cached!, targetName: target.name }
    : straightLineRoute(from, target);
}

/** [UI] The router answered, but there's no path on foot (e.g. across water). Retrying won't help. */
export class NoWalkingRouteError extends Error {
  constructor() {
    super('No walking path to this destination.');
    this.name = 'NoWalkingRouteError';
  }
}

export async function fetchWalkingRoute(from: LatLng, to: Place): Promise<Route> {
  const now = Date.now();
  if (now < nextRequestAt) throw new Error('Please wait a moment before requesting another route.');
  nextRequestAt = now + 1100;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const coords = `${from.longitude},${from.latitude};${to.coord.longitude},${to.coord.latitude}`;
    const response = await fetch(
      `https://routing.openstreetmap.de/routed-foot/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`,
      { signal: controller.signal, headers: { 'User-Agent': 'SafeHaven/0.1 (DubHacks walking-route demo)' } },
    );
    if (!response.ok) throw new Error('Walking route service unavailable.');
    const data = await response.json();
    if (data?.code === 'NoRoute') throw new NoWalkingRouteError();
    const route = data?.routes?.[0];
    const coordinates = route?.geometry?.coordinates;
    if (data?.code !== 'Ok' || route?.geometry?.type !== 'LineString' ||
        !Array.isArray(coordinates) || coordinates.length < 2 ||
        !Number.isFinite(route.distance) || route.distance < 0 ||
        !Number.isFinite(route.duration) || route.duration < 0 ||
        !coordinates.every((p: unknown) => Array.isArray(p) && p.length >= 2 &&
          Number.isFinite(p[0]) && Math.abs(p[0]) <= 180 &&
          Number.isFinite(p[1]) && Math.abs(p[1]) <= 90)) {
      throw new Error('No walking route available for this destination.');
    }
    return {
      targetId: to.id, targetName: to.name, from, to: to.coord,
      points: coordinates.map((p: number[]) => ({ latitude: p[1], longitude: p[0] })),
      distanceM: route.distance, durationS: route.duration,
      fetchedAt: Date.now(), isStraightLine: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Only the latest destination request may update the screen. */
export function createRouteRequestGuard() {
  let latest = 0;
  return () => {
    const id = ++latest;
    return () => id === latest;
  };
}
