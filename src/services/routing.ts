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

/**
 * TODO [MAP]: fetch a real walking route, fall back to straight line on any error.
 *   Free foot-routing OSRM (FOSSGIS):
 *   https://routing.openstreetmap.de/routed-foot/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=full&geometries=geojson
 *   → routes[0].geometry.coordinates is [lng, lat][]; routes[0].distance (m), routes[0].duration (s).
 *   (router.project-osrm.org only reliably serves car routes.)
 */
export async function fetchWalkingRoute(from: LatLng, to: Place): Promise<Route> {
  return straightLineRoute(from, to);
}
