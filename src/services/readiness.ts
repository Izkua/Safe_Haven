import { distanceM, formatAge } from '@/lib/geo';
import { loadSnapshot, persistSnapshot } from '@/services/offline';
import { fetchWalkingRoute, matchesDestination } from '@/services/routing';
import type { Group, LatLng, Member, OfflineSnapshot, Place, Route, TileRegion } from '@/types';

export type ReadinessInput = {
  group: Group | null; personalMeetingPlace: Place | null; myLocation: LatLng | null;
  myUid: string | null; myName: string; members: Member[]; route: Route | null; tiles: TileRegion | null;
};
export type Check = { id: string; label: string; ready: boolean; required: boolean; detail: string };
export type Readiness = { ready: boolean; checks: Check[]; checkedAt: number };
const meeting = (s: ReadinessInput) => s.group ? s.group.meetingPlace : s.personalMeetingPlace;
const samePlace = (a: Place | null, b: Place | null) => !!a && !!b && a.id === b.id && a.coord.latitude === b.coord.latitude && a.coord.longitude === b.coord.longitude;
const sameContext = (a: ReadinessInput, b: ReadinessInput) => a.group?.id === b.group?.id && samePlace(meeting(a), meeting(b));

/** Inspect disk, not just in-memory state or a Saved badge. */
export async function checkOfflineReadiness(input: ReadinessInput): Promise<Readiness> {
  const now = Date.now();
  const snap = await loadSnapshot();
  const target = meeting(input);
  const savedTarget = snap ? (snap.group ? snap.group.meetingPlace : snap.personalMeetingPlace ?? null) : null;
  const sameGroup = (snap?.group?.id ?? null) === (input.group?.id ?? null);
  const placeReady = sameGroup && samePlace(target, savedTarget);
  const savedRoute = snap?.route;
  const routeReady = placeReady && !!target && !!savedRoute && !savedRoute.isStraightLine && matchesDestination(savedRoute, target) && savedRoute.points.length >= 2 && savedRoute.points.every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)) && !!input.myLocation && distanceM(input.myLocation, savedRoute.from) <= 200;
  const others = input.group?.memberIds.filter((id) => id !== input.myUid) ?? [];
  const membersReady = sameGroup && !!snap && others.every((id) => {
    const m = snap.members.find((m) => m.uid === id);
    return !!m?.location && Number.isFinite(m.location.latitude) && Number.isFinite(m.location.longitude) && !!m.locationTs && now - m.locationTs >= 0 && now - m.locationTs <= 15 * 60000;
  });
  const checks: Check[] = [
    { id: 'place', label: 'Meeting place saved', ready: placeReady, required: true, detail: placeReady ? target!.name : 'Set a meeting place online, then prepare.' },
    { id: 'map', label: 'Apple Maps offline coverage', ready: false, required: false, detail: 'Not guaranteed. Apple controls its map cache. Saved meeting places, routes and compass remain available, but streets may be missing without internet.' },
    { id: 'route', label: 'Walking route available offline', ready: routeReady, required: true, detail: routeReady ? `Automatically saved ${formatAge(now - savedRoute!.fetchedAt)} when directions loaded. Map images are checked separately.` : 'A street route from near your current location is needed; a straight line does not count.' },
    { id: 'members', label: 'Group locations saved', ready: membersReady, required: !!input.group, detail: !input.group ? 'Not needed for a personal meeting place.' : others.length === 0 ? 'No other members in this group yet.' : membersReady ? `${others.length} members · last-known locations under 15 minutes old` : 'Some members have missing or old locations. Ask them to open the app online.' },
  ];
  return { ready: checks.filter((c) => c.required).every((c) => c.ready), checks, checkedAt: now };
}

/** Persist with errors surfaced, then read it back before declaring readiness. */
export async function prepareOffline(
  current: () => ReadinessInput,
  online: () => boolean,
  progress: (message: string) => void,
  apply: (route: Route, tiles: TileRegion | null) => void,
): Promise<void> {
  const initial = current();
  const target = meeting(initial);
  if (!online()) throw new Error('Connect to the internet before preparing.');
  if (!target || !initial.myLocation) throw new Error('Set a meeting place and wait for your GPS location first.');
  progress('Saving walking route…');
  const route = await fetchWalkingRoute(initial.myLocation, target);
  if (!sameContext(initial, current()) || !online()) throw new Error('Your destination or connection changed. Please prepare again.');
  const latest = current();
  const tiles = latest.tiles;
  const snapshot: Omit<OfflineSnapshot, 'version' | 'savedAt'> = {
    myUid: latest.myUid, myName: latest.myName, group: latest.group,
    personalMeetingPlace: latest.personalMeetingPlace, members: latest.members, route, tiles,
  };
  progress('Verifying saved information…');
  await persistSnapshot(snapshot);
  if (!sameContext(initial, current())) throw new Error('Your destination changed. Please prepare again.');
  apply(route, tiles);
}
